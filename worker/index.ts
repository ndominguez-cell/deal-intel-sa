import { SA_CENTROID, haversineDistance } from "../server/engine/constants";
import { runLicensedMarketPipeline } from "../server/engine/jobs";
import { DuplicateRunError, refreshTexasIndex } from "../server/market-index/job";
import { buildDemoTexasIndex } from "../server/market-index/texas";
import {
  MAX_LISTING_MILEAGE,
  MAX_LISTING_PRICE,
  MIN_LISTING_PRICE,
  MIN_MODEL_YEAR,
  SEARCH_RADIUS_MILES,
  TARGET_VEHICLES,
} from "../server/sources/types";
import { DatabaseStorage } from "../server/storage";
import { marketCheckPhotoUrl, PHOTO_CACHE_SECONDS, toPublicImageUrl } from "../server/photos";
import type { VehicleTargetFilter } from "../shared/schema";

type WorkerEnv = Env & { ADMIN_TOKEN?: string };

// Must match the second entry in triggers.crons (wrangler.jsonc). Each job runs
// as its own invocation, so it gets its own subrequest budget and a failure in
// one can't block the other.
// Weekly (Tuesdays 11:15 UTC): the index moves in whole weeks, and a daily run spent
// ~81 MarketCheck requests a day for the same numbers.
const TEXAS_INDEX_CRON = "15 11 * * 2";

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function parseJsonSafe(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  try { return JSON.parse(value); } catch { return value; }
}

// Serves a MarketCheck cached photo (which needs the API key) from the edge cache,
// fetching it with the key on a miss. See server/photos.ts.
async function handlePhotoRequest(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
  const upstream = marketCheckPhotoUrl(new URL(request.url).pathname);
  if (!upstream || !env.MARKETCHECK_API_KEY) return new Response(null, { status: 404 });

  // The DOM lib's CacheStorage type (also in scope) lacks the Workers-only `default` cache.
  const cache = (caches as unknown as { default: Cache }).default;
  // Key on the photo path only: a caller-chosen query string must not bypass the cache
  // and force a fresh (quota-spending) MarketCheck fetch.
  const keyUrl = new URL(request.url);
  keyUrl.search = "";
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${upstream}?api_key=${encodeURIComponent(env.MARKETCHECK_API_KEY)}`);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new Response(null, { status: 404 });

  const response = new Response(res.body, {
    headers: { "Content-Type": type, "Cache-Control": `public, max-age=${PHOTO_CACHE_SECONDS}, immutable` },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function getStorage(env: WorkerEnv): DatabaseStorage {
  return new DatabaseStorage(env.DB);
}

async function runTrackedSync(env: WorkerEnv): Promise<Awaited<ReturnType<typeof runLicensedMarketPipeline>>> {
  const startedAt = Math.floor(Date.now() / 1000);
  const inserted = await env.DB.prepare("INSERT INTO sync_runs (started_at, status) VALUES (?, 'running') RETURNING id").bind(startedAt).first<{ id: number }>();
  try {
    const storage = getStorage(env);
    await storage.ensureVehicleTargets(TARGET_VEHICLES);
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
  // Trim both sides: secrets pasted into the Cloudflare dashboard often carry
  // a trailing space or newline, which would otherwise reject the right password.
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
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
          imageUrls: (deal.imageUrls ?? []).map(toPublicImageUrl),
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

  if (request.method === "POST" && url.pathname === "/api/leads") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (typeof body?.website === "string" && body.website.trim()) return json({ accepted: true }, { status: 202 });
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const email = typeof body?.email === "string" ? body.email.trim().slice(0, 160) : "";
    if (!name || (!phone && !email)) return json({ error: "name and phone or email are required" }, { status: 400 });
    const lead = await storage.insertLead({ name, phone: phone || null, email: email || null, vehicleMake: typeof body?.vehicleMake === "string" ? body.vehicleMake.trim().slice(0, 80) : null, vehicleModel: typeof body?.vehicleModel === "string" ? body.vehicleModel.trim().slice(0, 80) : null, listingId: typeof body?.listingId === "number" ? body.listingId : null, source: typeof body?.source === "string" ? body.source.slice(0, 40) : "landing_page", utmSource: typeof body?.utmSource === "string" ? body.utmSource.slice(0, 120) : null, utmCampaign: typeof body?.utmCampaign === "string" ? body.utmCampaign.slice(0, 120) : null, notes: typeof body?.notes === "string" ? body.notes.slice(0, 500) : null });
    return json({ accepted: true, leadId: lead.id }, { status: 201 });
  }

  if (url.pathname === "/api/leads" || url.pathname.startsWith("/api/leads/")) {
    if (!(await isAuthorized(request, env))) return json({ error: "Unauthorized" }, { status: 401 });
    if (request.method === "GET") {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 250);
      return json({ leads: await storage.getLeads(limit, url.searchParams.get("status") ?? undefined) });
    }
    const leadStatus = url.pathname.match(/^\/api\/leads\/(\d+)\/status$/);
    if (request.method === "PATCH" && leadStatus) {
      const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
      const status = typeof body?.status === "string" ? body.status.trim().slice(0, 40) : "";
      if (!status) return json({ error: "status is required" }, { status: 400 });
      await storage.updateLeadStatus(Number(leadStatus[1]), status);
      return json({ updated: true });
    }
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

  if (request.method === "GET" && url.pathname === "/api/market-index/texas") {
    const stored = await storage.getLatestMarketIndexReport("TX");
    return json({
      report: stored ?? buildDemoTexasIndex(),
      marketCheckConfigured: Boolean(env.MARKETCHECK_API_KEY?.trim()),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/jobs/market-index/texas") {
    if (!env.ADMIN_TOKEN?.trim()) {
      return json({ error: "Manual refresh is not configured" }, { status: 503 });
    }
    if (!(await isAuthorized(request, env))) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const report = await refreshTexasIndex(storage, env.MARKETCHECK_API_KEY);
      return json({ status: "completed", asOf: report.asOf, weeks: report.series.length, errors: report.errors });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 502 },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/api/jobs/sync") {
    if (!env.ADMIN_TOKEN?.trim()) {
      return json({ error: "Manual sync is not configured" }, { status: 503 });
    }
    if (!(await isAuthorized(request, env))) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    // Admin-only route, and provider errors are already key-redacted, so
    // return the real reason instead of the generic 500 the dashboard can't act on.
    try {
      return json({
        status: "completed",
        ...(await runTrackedSync(env)),
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 502 },
      );
    }
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

async function runScheduledTexasIndex(env: WorkerEnv, scheduledTime: number): Promise<void> {
  try {
    const report = await refreshTexasIndex(getStorage(env), env.MARKETCHECK_API_KEY, { skipIfRecentRun: true });
    console.log(
      JSON.stringify({
        event: "texas_market_index_refresh_completed",
        scheduledTime: new Date(scheduledTime).toISOString(),
        weeks: report.series.length,
        indexValue: report.headline.indexValue,
        errors: report.errors.length,
      }),
    );
  } catch (error) {
    if (error instanceof DuplicateRunError) {
      console.log(JSON.stringify({ event: "texas_market_index_refresh_skipped", reason: error.message }));
      return;
    }
    console.error(
      JSON.stringify({
        event: "texas_market_index_refresh_failed",
        scheduledTime: new Date(scheduledTime).toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname.startsWith("/api/photo/")) {
      return handlePhotoRequest(request, env, ctx);
    }

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
    // Any cron other than the index's runs the inventory sync, so retiming
    // the sync in wrangler.jsonc alone can't silently stop it.
    if (controller.cron === TEXAS_INDEX_CRON) {
      ctx.waitUntil(runScheduledTexasIndex(env, controller.scheduledTime));
    } else {
      ctx.waitUntil(runScheduledSync(env, controller.scheduledTime));
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
