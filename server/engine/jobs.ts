import type { Listing } from "@shared/schema";
import type {
  IStorage,
  ListingWrite,
  MarketCompWrite,
  ScoreWrite,
} from "../storage";
import { fetchAutoDevListings } from "../sources/autodev";
import { fetchMarketCheckListings } from "../sources/marketcheck";
import {
  LICENSED_MARKET_SOURCE,
  MAX_LISTING_PRICE,
  MIN_LISTING_PRICE,
  isEligibleListing,
  numberOrNull,
  type InventoryProvider,
  type ProviderFetchResult,
  type ProviderSecrets,
  type RawVehicleListing,
  type VehicleTarget,
} from "../sources/types";
import { getVehicleSegment } from "./constants";
import { estimateMarketValue } from "./market-value";
import { normalizeListing } from "./normalize";
import { scoreDeal } from "./scoring";

export interface IngestionResult {
  processed: number;
  inserted: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

export interface PipelineResult {
  source: typeof LICENSED_MARKET_SOURCE;
  providers: ProviderRunSummary[];
  sourceCount: number;
  accepted: number;
  excludedOverPrice: number;
  excludedInvalid: number;
  excludedDuplicates: number;
  ingestion: IngestionResult;
  scoring: { scored: number; errors: string[] };
}

export interface ProviderRunSummary {
  provider: InventoryProvider;
  status: "completed" | "failed";
  sourceCount: number;
  accepted: number;
  excludedOverPrice: number;
  excludedInvalid: number;
  error?: string;
}

interface IngestionOptions {
  deactivateMissing?: boolean;
}

export async function runIngestion(
  storage: IStorage,
  rawListings: RawVehicleListing[],
  source = LICENSED_MARKET_SOURCE,
  startedAt = new Date(),
  options: IngestionOptions = {},
): Promise<IngestionResult> {
  const job = await storage.insertJobRun("ingest");
  const errors: string[] = [];
  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let deactivated = 0;

  try {
    const existingListings = await storage.getAllListings();
    const existingByVin = new Map(
      existingListings
        .filter((listing) => listing.vin)
        .map((listing) => [listing.vin!.trim().toUpperCase(), listing]),
    );
    const existingBySourceId = new Map(
      existingListings
        .filter((listing) => listing.externalId)
        .map((listing) => [
          `${listing.source}:${listing.externalId}`,
          listing,
        ]),
    );
    const writes: ListingWrite[] = [];

    for (const raw of rawListings) {
      try {
        if (!isEligibleListing(raw)) continue;
        const normalized = normalizeListing(raw, source);
        if (
          !normalized.price ||
          normalized.price < MIN_LISTING_PRICE ||
          normalized.price > MAX_LISTING_PRICE
        ) continue;
        const vin = normalized.vin?.trim().toUpperCase();
        const canonical =
          (vin ? existingByVin.get(vin) : undefined) ??
          (normalized.externalId
            ? existingBySourceId.get(`${source}:${normalized.externalId}`)
            : undefined);

        writes.push({ ...normalized, id: canonical?.id });
        if (canonical) {
          updated += 1;
        } else {
          inserted += 1;
        }
      } catch (error) {
        errors.push(
          `Listing ${raw.external_id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (errors.length === 0 && writes.length > 0) {
      await storage.upsertListings(writes, startedAt);
      processed = writes.length;
    }

    if (
      options.deactivateMissing !== false &&
      errors.length === 0 &&
      processed > 0
    ) {
      deactivated = await storage.deactivateListingsNotSeenSince(source, startedAt);
    }
  } catch (error) {
    errors.push(`Ingestion: ${error instanceof Error ? error.message : String(error)}`);
  }

  await storage.completeJobRun(job.id, processed, errors);
  return { processed, inserted, updated, deactivated, errors };
}

export async function runScoring(
  storage: IStorage,
): Promise<{ scored: number; errors: string[] }> {
  const job = await storage.insertJobRun("score");
  const errors: string[] = [];
  let scored = 0;

  try {
    const activeListings = await storage.getActiveListings();
    const snapshots = await storage.getSnapshotsForListings(
      activeListings.map((listing) => listing.id),
    );
    const snapshotsByListing = new Map<number, typeof snapshots>();
    for (const snapshot of snapshots) {
      const listingSnapshots = snapshotsByListing.get(snapshot.listingId) ?? [];
      listingSnapshots.push(snapshot);
      snapshotsByListing.set(snapshot.listingId, listingSnapshots);
    }
    const scoreWrites: ScoreWrite[] = [];

    for (const listing of activeListings) {
      try {
        const marketValue = estimateMarketValue(listing, activeListings);
        const result = scoreDeal(
          listing,
          marketValue,
          snapshotsByListing.get(listing.id) ?? [],
        );

        const savingsAmount =
          marketValue && listing.price
            ? marketValue.marketValueEst - listing.price
            : null;

        scoreWrites.push({
          listingId: listing.id,
          dealScore: result.dealScore,
          marketValueEst: marketValue?.marketValueEst ?? null,
          compCount: marketValue?.compCount ?? null,
          compPriceMedian: marketValue?.compPriceMedian ?? null,
          confidence: marketValue?.confidence ?? null,
          savingsAmount,
          scoreBreakdown: result.scoreBreakdown,
          scoreReasons: result.scoreReasons,
          velocityPrediction: result.velocityPrediction,
          wholesaleEstimate: result.wholesaleEstimate,
          suggestedOffer: result.suggestedOffer,
        });
      } catch (error) {
        errors.push(
          `Scoring listing ${listing.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await storage.upsertDealScores(scoreWrites);
    scored = scoreWrites.length;

    await computeMarketIndex(storage, activeListings);
  } catch (error) {
    errors.push(`Scoring: ${error instanceof Error ? error.message : String(error)}`);
  }

  await storage.completeJobRun(job.id, scored, errors);
  return { scored, errors };
}

interface AggregatedListing {
  listing: RawVehicleListing;
  payloads: Partial<Record<InventoryProvider, unknown>>;
}

function preferredListing(
  current: RawVehicleListing,
  incoming: RawVehicleListing,
): [RawVehicleListing, RawVehicleListing] {
  const currentPrice = numberOrNull(current.price);
  const incomingPrice = numberOrNull(incoming.price);
  if (currentPrice !== null && incomingPrice !== null && currentPrice !== incomingPrice) {
    return incomingPrice < currentPrice ? [incoming, current] : [current, incoming];
  }

  const quality = (listing: RawVehicleListing): number =>
    [
      listing.vin,
      listing.trim,
      listing.body_type,
      listing.mileage,
      listing.listing_url,
      listing.postal_code,
      listing.lat,
      listing.lon,
    ].filter((value) => value !== null && value !== undefined && value !== "")
      .length +
    Math.min(listing.image_urls.length, 3) +
    (listing.provider === "marketcheck" ? 1 : 0);

  return quality(incoming) > quality(current)
    ? [incoming, current]
    : [current, incoming];
}

function mergeListingFields(
  current: RawVehicleListing,
  incoming: RawVehicleListing,
): RawVehicleListing {
  const [preferred, fallback] = preferredListing(current, incoming);
  return {
    ...preferred,
    external_id: preferred.vin ?? preferred.external_id,
    vin: preferred.vin ?? fallback.vin,
    trim: preferred.trim ?? fallback.trim,
    body_type: preferred.body_type ?? fallback.body_type,
    mileage: preferred.mileage ?? fallback.mileage,
    postal_code: preferred.postal_code ?? fallback.postal_code,
    lat: preferred.lat ?? fallback.lat,
    lon: preferred.lon ?? fallback.lon,
    listing_url: preferred.listing_url ?? fallback.listing_url,
    title_status:
      preferred.title_status === "clean" || fallback.title_status === "clean"
        ? "clean"
        : "unknown",
    image_urls: Array.from(
      new Set([...preferred.image_urls, ...fallback.image_urls]),
    ).slice(0, 12),
  };
}

export function mergeProviderListings(
  rawListings: RawVehicleListing[],
): RawVehicleListing[] {
  const aggregated = new Map<string, AggregatedListing>();

  for (const raw of rawListings) {
    const vin = raw.vin?.trim().toUpperCase();
    const key = vin || `${raw.provider}:${raw.external_id}`;
    const existing = aggregated.get(key);
    if (!existing) {
      aggregated.set(key, {
        listing: { ...raw, vin: vin ?? null },
        payloads: { [raw.provider]: raw.raw_payload },
      });
      continue;
    }

    existing.listing = mergeListingFields(existing.listing, {
      ...raw,
      vin: vin ?? null,
    });
    existing.payloads[raw.provider] = raw.raw_payload;
  }

  return Array.from(aggregated.values(), ({ listing, payloads }) => ({
    ...listing,
    external_id: listing.vin ?? listing.external_id,
    raw_payload: { providers: payloads },
  }));
}

export async function runLicensedMarketPipeline(
  storage: IStorage,
  secrets: ProviderSecrets,
  configuredTargets?: readonly VehicleTarget[],
): Promise<PipelineResult> {
  const startedAt = new Date();
  const providerNames: InventoryProvider[] = ["marketcheck", "autodev"];
  const targets = configuredTargets?.length ? configuredTargets : undefined;
  const settled = await Promise.allSettled([
    fetchMarketCheckListings(secrets.MARKETCHECK_API_KEY, targets),
    fetchAutoDevListings(secrets.AUTODEV_API_KEY, targets),
  ]);
  const completed: ProviderFetchResult[] = [];
  const providers: ProviderRunSummary[] = settled.map((result, index) => {
    const provider = providerNames[index];
    if (result.status === "fulfilled") {
      completed.push(result.value);
      return {
        provider,
        status: "completed",
        sourceCount: result.value.sourceCount,
        accepted: result.value.listings.length,
        excludedOverPrice: result.value.excludedOverPrice,
        excludedInvalid: result.value.excludedInvalid,
      };
    }
    return {
      provider,
      status: "failed",
      sourceCount: 0,
      accepted: 0,
      excludedOverPrice: 0,
      excludedInvalid: 0,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });

  if (completed.length === 0) {
    throw new Error(
      `All licensed inventory providers failed: ${providers
        .map((provider) => `${provider.provider}: ${provider.error ?? "unknown error"}`)
        .join("; ")}`,
    );
  }

  const providerListings = completed.flatMap((result) => result.listings);
  const mergedListings = mergeProviderListings(providerListings);
  const ingestion = await runIngestion(
    storage,
    mergedListings,
    LICENSED_MARKET_SOURCE,
    startedAt,
    { deactivateMissing: completed.length === providerNames.length },
  );

  if (ingestion.processed === 0 || ingestion.errors.length > 0) {
    throw new Error(
      `Licensed inventory ingestion did not complete cleanly (${ingestion.processed} processed, ${ingestion.errors.length} errors)`,
    );
  }

  const scoring = await runScoring(storage);
  if (scoring.scored === 0 || scoring.errors.length > 0) {
    throw new Error(
      `Licensed inventory scoring did not complete cleanly (${scoring.scored} scored, ${scoring.errors.length} errors)`,
    );
  }
  return {
    source: LICENSED_MARKET_SOURCE,
    providers,
    sourceCount: completed.reduce((sum, result) => sum + result.sourceCount, 0),
    accepted: mergedListings.length,
    excludedOverPrice: completed.reduce(
      (sum, result) => sum + result.excludedOverPrice,
      0,
    ),
    excludedInvalid: completed.reduce(
      (sum, result) => sum + result.excludedInvalid,
      0,
    ),
    excludedDuplicates: providerListings.length - mergedListings.length,
    ingestion,
    scoring,
  };
}

async function computeMarketIndex(storage: IStorage, listings: Listing[]): Promise<void> {
  const segments: Record<string, Listing[]> = {};
  const writes: MarketCompWrite[] = [];

  for (const listing of listings) {
    const segment = getVehicleSegment(listing.model);
    (segments[segment] ??= []).push(listing);
  }

  for (const [segment, segmentListings] of Object.entries(segments)) {
    const prices = segmentListings
      .map((listing) => listing.price)
      .filter((price): price is number => price !== null);
    if (prices.length === 0) continue;

    const sorted = [...prices].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const medianPrice =
      sorted.length % 2 !== 0
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;

    writes.push({
      city: "San Antonio",
      vehicleSegment: segment,
      medianPrice: Math.round(medianPrice),
      inventoryCount: segmentListings.length,
      avgDaysOnMarket: null,
      priceChange30d: null,
      demandVelocity:
        segment.includes("truck") || segment.includes("suv") ? "High" : "Medium",
    });
  }

  await storage.upsertMarketCompsBatch(writes);
}
