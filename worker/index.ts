import { SA_CENTROID, haversineDistance } from "../server/engine/constants";
import { runLicensedMarketPipeline } from "../server/engine/jobs";
import {
  MAX_LISTING_MILEAGE,
  MAX_LISTING_PRICE,
  MIN_LISTING_PRICE,
  MIN_MODEL_YEAR,
  SEARCH_RADIUS_MILES,
  TARGET_VEHICLES,
} from "../server/sources/types";
import { DatabaseStorage } from "../server/storage";
import type { VehicleTargetFilter } from "../shared/schema";

type WorkerEnv = Env & { ADMIN_TOKEN?: string };

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function parseJsonSafe(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  try { return JSON.parse(value); } catch { return value; }
}

function getStorage(env: WorkerEnv): DatabaseStorage {
  return new DatabaseStorage(env.DB);
}

async function runTrackedSync(env: WorkerEnv): Promise<Awaited<ReturnType<typeof runLicensedMarketPipeline>>> {
  const startedAt = Math.floor(Date.now() / 1000);
  const inserted = await env.DB.prepare("INSERT INTO sync_runs (started_at, status) VALUES (?, 'running') RETURNING id").bind(startedAt).first<{ id: number }>();
  try {
    const storage = getStorage(env);
    const result = await runLicensedMarketPipeline(storage, env, await storage.getActiveVehicleTargets());
    const status = result.ingestion.processed === 0 ? "empty" : "ok";
    await env.DB.prepare("UPDATE sync_runs SET finished_at = ?, status = ?, listings_fetched = ?, listings_written = ?, sources_summary = ? WHERE id = ?")
      .bind(Math.floor(Date.now() / 1000), status, result.sourceCount, result.ingestion.processed, JSON.stringify(result.providers), inserted?.id ?? null).run();
    return result;
  } catch (error) {
    await env.DB.prepare("UPDATE sync_runs SET finished_at = ?, status = 'error', error_message = ? WHERE id = ?")
      .bind(Math.floor(Date.now() / 1000), error instanceof Error ? error.message : String(error), inserted?.id ?? null).run();
    throw error;
  }
}

function constantTimeEqual(left: ArrayBuffer, right: ArrayBuffer): boolean {
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index % leftBytes.length] ?? 0) ^
      (rightBytes[index % rightBytes.length] ?? 0);
  }
  return difference === 0;
}

async function isAuthorized(request: Request, env: WorkerEnv): Promise<boolean> {
  if (!env.ADMIN_TOKEN) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_TOKEN)),
  ]);
  return constantTimeEqual(providedHash, expectedHash);
}

async function handleDatabaseRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const storage = getStorage(env);
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/deals/top") {
    const minScore = Number.parseFloat(url.searchParams.get("min_score") ?? "") || 0;
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10) || 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 250);
    const deals = await storage.getTopDeals(minScore, limit);

    return json({
      deals: deals.map((deal, index) => ({
        rank: index + 1,
        listing: {
          id: deal.id,
          year: deal.year,
          make: deal.make,
          model: deal.model,
          trim: deal.trim,
          bodyType: deal.bodyType,
          price: deal.price,
          mileage: deal.mileage,
          city: deal.city,
          state: deal.state,
          distance:
            deal.lat && deal.lon
              ? Math.round(
                  haversineDistance(
                    SA_CENTROID.lat,
                    SA_CENTROID.lon,
                    deal.lat,
                    deal.lon,
                  ),
                )
              : null,
          dealerName: deal.dealerName,
          isDealer: deal.isDealer,
          listingUrl: deal.listingUrl,
          titleStatus: deal.titleStatus,
          imageUrls: deal.imageUrls,
          firstSeenAt: deal.firstSeenAt,
          lastSeenAt: deal.lastSeenAt,
        },
        score: {
          dealScore: deal.score.dealScore,
          marketValueEst: deal.score.marketValueEst,
          compCount: deal.score.compCount,
          compPriceMedian: deal.score.compPriceMedian,
          confidence: deal.score.confidence,
          savingsAmount: deal.score.savingsAmount,
          scoreBreakdown: deal.score.scoreBreakdown,
          scoreReasons: deal.score.scoreReasons,
          velocityPrediction: deal.score.velocityPrediction,
          wholesaleEstimate: deal.score.wholesaleEstimate,
          suggestedOffer: deal.score.suggestedOffer,
        },
      })),
      total: deals.length,
      minListingPrice: MIN_LISTING_PRICE,
      maxListingPrice: MAX_LISTING_PRICE,
    });
  }

  const listingMatch = url.pathname.match(/^\/api\/listings\/(\d+)$/);
  if (request.method === "GET" && listingMatch) {
    const id = Number.parseInt(listingMatch[1], 10);
    const listing = await storage.getListingById(id);

    if (!listing || !listing.isActive) {
      return json({ error: "Listing not found" }, { status: 404 });
    }

    const score = await storage.getDealScoreForListing(id);
    const snapshots = await storage.getSnapshotsForListing(id);
    return json({
      listing,
      score: score ?? null,
      priceHistory: snapshots.map((snapshot) => ({
        price: snapshot.price,
        mileage: snapshot.mileage,
        date: snapshot.snapshotAt,
      })),
    });
  }

  if (request.method === "GET" && url.pathname === "/api/stats/market") {
    const city = url.searchParams.get("city") || "San Antonio";
    const make = url.searchParams.get("make");
    const model = url.searchParams.get("model");

    if (make && model) {
      const comp = await storage.getMarketCompsByMakeModel(city, make, model);
      return comp
        ? json(comp)
        : json({ error: "No market data for this make/model" }, { status: 404 });
    }

    return json({ city, segments: await storage.getMarketComps(city) });
  }

  if (request.method === "GET" && url.pathname === "/api/stats/overview") {
    const [totalListings, topDeals, priceDrops, comps, latestIngest] =
      await Promise.all([
        storage.getListingsCount(),
        storage.getTopDeals(85, 999),
        storage.getPriceDropCount24h(),
        storage.getMarketComps("San Antonio"),
        storage.getLatestJobRun("ingest"),
      ]);

    return json({
      totalListings,
      belowMarketToday: topDeals.length,
      avgDealScore:
        topDeals.length > 0
          ? Math.round(
              topDeals.reduce((sum, deal) => sum + deal.score.dealScore, 0) /
                topDeals.length,
            )
          : 0,
      priceDrops24h: priceDrops,
      marketIndex: comps,
      latestIngest: latestIngest
        ? {
            status: latestIngest.status,
            startedAt: latestIngest.startedAt,
            completedAt: latestIngest.completedAt,
            recordsProcessed: latestIngest.recordsProcessed,
          }
        : null,
      automation: {
        sources: ["MarketCheck", "Auto.dev"],
        cadence: "daily",
        minListingPrice: MIN_LISTING_PRICE,
        maxListingPrice: MAX_LISTING_PRICE,
        maxListingMileage: MAX_LISTING_MILEAGE,
        minimumModelYear: MIN_MODEL_YEAR,
        radiusMiles: SEARCH_RADIUS_MILES,
        targetVehicles: TARGET_VEHICLES,
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/jobs/status") {
    const rows = await env.DB.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 10").all<Record<string, unknown>>();
    const runs = (rows.results ?? []).map((row) => ({ ...row, sourcesSummary: parseJsonSafe(row.sources_summary) }));
    const latest = runs[0] as { status?: string; finished_at?: number } | undefined;
    const healthy = latest?.status === "ok" && Number(latest.finished_at ?? 0) >= Math.floor(Date.now() / 1000) - 36 * 60 * 60;
    return json({ healthy, runs });
  }

  if (url.pathname === "/api/admin/targets") {
    if (!(await isAuthorized(request, env))) return json({ error: "Unauthorized" }, { status: 401 });
    if (request.method === "GET") return json({ targets: await storage.getActiveVehicleTargets() });
    if (request.method === "POST") {
      const body = (await request.json().catch(() => null)) as Partial<VehicleTargetFilter> | null;
      const make = typeof body?.make === "string" ? body.make.trim() : "";
      const model = typeof body?.model === "string" ? body.model.trim() : "";
      if (!make || !model) return json({ error: "make and model are required" }, { status: 400 });
      const optionalNumber = (value: unknown): number | null | undefined =>
        value === null ? null : typeof value === "number" && Number.isFinite(value) ? value : undefined;
      const target = await storage.addVehicleTarget({ make, model, yearMin: optionalNumber(body?.yearMin), priceMax: optionalNumber(body?.priceMax), mileageMax: optionalNumber(body?.mileageMax) });
      return json({ target }, { status: 201 });
    }
  }

  const targetDelete = url.pathname.match(/^\/api\/admin\/targets\/(\d+)$/);
  if (request.method === "DELETE" && targetDelete) {
    if (!(await isAuthorized(request, env))) return json({ error: "Unauthorized" }, { status: 401 });
    await storage.deactivateVehicleTarget(Number(targetDelete[1]));
    return json({ status: "deactivated", id: Number(targetDelete[1]) });
  }

  if (request.method === "POST" && url.pathname === "/api/jobs/sync") {
    if (!env.ADMIN_TOKEN) {
      return json({ error: "Manual sync is not configured" }, { status: 503 });
    }
    if (!(await isAuthorized(request, env))) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    return json({
      status: "completed",
      ...(await runTrackedSync(env)),
    });
  }

  return json({ error: "API route not found" }, { status: 404 });
}

async function runScheduledSync(env: WorkerEnv, scheduledTime: number): Promise<void> {
  try {
    const result = await runTrackedSync(env);
    console.log(
      JSON.stringify({
        event: "licensed_market_daily_sync_completed",
        scheduledTime: new Date(scheduledTime).toISOString(),
        providers: result.providers,
        sourceCount: result.sourceCount,
        accepted: result.accepted,
        excludedDuplicates: result.excludedDuplicates,
        inserted: result.ingestion.inserted,
        updated: result.ingestion.updated,
        deactivated: result.ingestion.deactivated,
        scored: result.scoring.scored,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "licensed_market_daily_sync_failed",
        scheduledTime: new Date(scheduledTime).toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        status: "ok",
        timestamp: new Date().toISOString(),
        region: "San Antonio, TX",
        runtime: "cloudflare-workers",
        database: "cloudflare-d1",
        sources: ["marketcheck", "autodev"],
        minListingPrice: MIN_LISTING_PRICE,
        maxListingPrice: MAX_LISTING_PRICE,
        maxListingMileage: MAX_LISTING_MILEAGE,
        minimumModelYear: MIN_MODEL_YEAR,
        radiusMiles: SEARCH_RADIUS_MILES,
      });
    }

    if (!url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    try {
      return await handleDatabaseRequest(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "API request failed",
          error: error instanceof Error ? error.message : String(error),
          method: request.method,
          path: url.pathname,
        }),
      );
      return json({ error: "Internal Server Error" }, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(runScheduledSync(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<WorkerEnv>;
