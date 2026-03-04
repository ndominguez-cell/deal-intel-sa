import { storage } from "../storage";
import { normalizeListing } from "./normalize";
import { checkDuplicate } from "./dedupe";
import { estimateMarketValue } from "./market-value";
import { scoreDeal } from "./scoring";
import { getVehicleSegment } from "./constants";
import { SEED_LISTINGS } from "../seed-data";
import type { Listing } from "@shared/schema";

export async function runIngestion(): Promise<{ processed: number; errors: string[] }> {
  const job = await storage.insertJobRun("ingest");
  const errors: string[] = [];
  let processed = 0;

  try {
    const rawListings = SEED_LISTINGS;
    const existingListings = await storage.getAllListings();

    for (const raw of rawListings) {
      try {
        const normalized = normalizeListing(raw, "seed_data");
        const dupeResult = checkDuplicate(normalized, existingListings);

        if (dupeResult.isDuplicate && dupeResult.canonicalId) {
          await storage.updateListingLastSeen(dupeResult.canonicalId);
          const canonical = existingListings.find((l) => l.id === dupeResult.canonicalId);
          if (canonical && normalized.price && canonical.price !== normalized.price) {
            await storage.insertSnapshot(dupeResult.canonicalId, normalized.price, normalized.mileage ?? null);
          }
        } else {
          const inserted = await storage.insertListing(normalized);
          existingListings.push(inserted);
          await storage.insertSnapshot(inserted.id, normalized.price ?? null, normalized.mileage ?? null);
        }
        processed++;
      } catch (err: any) {
        errors.push(`Error processing listing: ${err.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Ingestion error: ${err.message}`);
  }

  await storage.completeJobRun(job.id, processed, errors);
  return { processed, errors };
}

export async function runScoring(): Promise<{ scored: number; errors: string[] }> {
  const job = await storage.insertJobRun("score");
  const errors: string[] = [];
  let scored = 0;

  try {
    const allListings = await storage.getAllListings();

    for (const listing of allListings) {
      try {
        const marketValue = estimateMarketValue(listing, allListings);
        const snapshots = await storage.getSnapshotsForListing(listing.id);
        const result = scoreDeal(listing, marketValue, snapshots);

        const savingsAmount = marketValue && listing.price
          ? marketValue.marketValueEst - listing.price
          : null;

        await storage.upsertDealScore({
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

        scored++;
      } catch (err: any) {
        errors.push(`Error scoring listing ${listing.id}: ${err.message}`);
      }
    }

    await computeMarketIndex(allListings);
  } catch (err: any) {
    errors.push(`Scoring error: ${err.message}`);
  }

  await storage.completeJobRun(job.id, scored, errors);
  return { scored, errors };
}

async function computeMarketIndex(allListings: Listing[]) {
  const segments: Record<string, Listing[]> = {};

  for (const listing of allListings) {
    const seg = getVehicleSegment(listing.model);
    if (!segments[seg]) segments[seg] = [];
    segments[seg].push(listing);
  }

  for (const [segment, segListings] of Object.entries(segments)) {
    const prices = segListings.filter((l) => l.price).map((l) => l.price!);
    if (prices.length === 0) continue;

    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianPrice =
      sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const velocity =
      segment.includes("truck") || segment.includes("suv") ? "High" : "Medium";

    await storage.upsertMarketComps({
      city: "San Antonio",
      vehicleSegment: segment,
      medianPrice: Math.round(medianPrice),
      inventoryCount: segListings.length,
      avgDaysOnMarket: null,
      priceChange30d: null,
      demandVelocity: velocity,
    });
  }
}
