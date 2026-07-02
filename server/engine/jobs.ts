import { storage } from "../storage";
import { normalizeListing } from "./normalize";
import { checkDuplicate } from "./dedupe";
import { estimateMarketValue } from "./market-value";
import { scoreDeal } from "./scoring";
import { getVehicleSegment, SA_CENTROID } from "./constants";
import { SEED_LISTINGS } from "../seed-data";
import { sendAppointmentReminder, isSmsConfigured } from "../sms";
import { fetchLiveListings, isMarketCheckConfigured, type LiveIngestCriteria } from "./sources/marketcheck";
import type { Listing } from "@shared/schema";

export async function runIngestion(
  rawInput?: any[],
  source: string = "seed_data"
): Promise<{ processed: number; errors: string[] }> {
  const job = await storage.insertJobRun(source === "seed_data" ? "ingest" : `import:${source}`);
  const errors: string[] = [];
  let processed = 0;

  try {
    const rawListings = rawInput ?? SEED_LISTINGS;
    const existingListings = await storage.getAllListings();

    for (const raw of rawListings) {
      try {
        const normalized = normalizeListing(raw, source);
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
          urgency: result.urgency,
          daysOnMarket: result.daysOnMarket,
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

// Day-before reminder sweep. Meant to be called on a short interval (e.g.
// every 15-30 min via setInterval in index.ts, or an external cron hitting
// POST /api/jobs/send-reminders). The 20-28h window is intentionally wider
// than 24h exactly so a periodic sweep can't skip an appointment between runs.
export async function runReminderSweep(): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const job = await storage.insertJobRun("sms_reminders");
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    if (!isSmsConfigured()) {
      errors.push("Twilio not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER) — sweep is a no-op");
    } else {
      const now = new Date();
      const from = new Date(now.getTime() + 20 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + 28 * 60 * 60 * 1000);
      const due = await storage.getAppointmentsNeedingReminders(from, to);

      for (const appt of due) {
        try {
          if (!appt.buyerLead) {
            await storage.updateAppointmentSmsStatus(appt.id, "reminder", "skipped");
            skipped++;
            continue;
          }
          const result = await sendAppointmentReminder(appt, appt.buyerLead, appt.listing);
          if (result.status === "sent") sent++;
          else if (result.status === "skipped") skipped++;
          else failed++;
        } catch (err: any) {
          failed++;
          errors.push(`Appointment ${appt.id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    errors.push(`Reminder sweep error: ${err.message}`);
  }

  await storage.completeJobRun(job.id, sent + skipped + failed, errors);
  return { sent, skipped, failed, errors };
}

// Live multi-source listing ingestion via a licensed data vendor
// (MarketCheck) — Priority #4. Deliberately NOT auto-scheduled on a timer:
// unlike the free SMS reminder sweep, every call to this costs against a
// paid API quota, so it's meant to be triggered by the business owner's own
// cron/scheduler hitting POST /api/jobs/ingest-live on whatever cadence
// they're comfortable paying for — daily is a reasonable starting point.
export async function runLiveIngestion(
  criteriaOverride?: Partial<LiveIngestCriteria>
): Promise<{ fetched: number; numFound: number; imported: number; scored: number; errors: string[] }> {
  const errors: string[] = [];

  if (!isMarketCheckConfigured()) {
    return { fetched: 0, numFound: 0, imported: 0, scored: 0, errors: ["MARKETCHECK_API_KEY not set — live ingestion is a no-op"] };
  }

  const criteria: LiveIngestCriteria = {
    latitude: SA_CENTROID.lat,
    longitude: SA_CENTROID.lon,
    radiusMiles: parseInt(process.env.LIVE_INGEST_RADIUS_MILES || "40", 10),
    carType: "used",
    ...criteriaOverride,
  };
  const maxRows = parseInt(process.env.LIVE_INGEST_MAX_ROWS || "300", 10);

  const { rows, numFound, errors: fetchErrors } = await fetchLiveListings(criteria, maxRows);
  errors.push(...fetchErrors);

  if (rows.length === 0) {
    return { fetched: 0, numFound, imported: 0, scored: 0, errors };
  }

  const ingest = await runIngestion(rows, "marketcheck");
  const scoring = await runScoring();

  return {
    fetched: rows.length,
    numFound,
    imported: ingest.processed,
    scored: scoring.scored,
    errors: [...errors, ...ingest.errors, ...scoring.errors],
  };
}
