import type { Listing, ListingSnapshot } from "@shared/schema";
import {
  RELIABILITY_SCORES,
  SA_DEMAND_BOOSTS,
  SA_DEMAND_PENALTIES,
} from "./constants";
import type { MarketValueResult } from "./market-value";

export type UrgencyTier = "act_now" | "strong_lead" | "negotiate" | "monitor" | "pass";

export interface ScoringResult {
  dealScore: number;
  scoreBreakdown: {
    priceAdvantage: number;
    mileageAdvantage: number;
    localDemand: number;
    reliability: number;
    sellerQuality: number;
    priceDropSignal: number;
  };
  scoreReasons: string[];
  velocityPrediction: number;
  wholesaleEstimate: number;
  suggestedOffer: number;
  urgency: UrgencyTier;
  daysOnMarket: number | null;
}

function getSeasonalFactor(): number {
  const month = new Date().getMonth() + 1;
  // Tax-refund season (Feb-Apr) and summer lift demand slightly
  if (month >= 2 && month <= 4) return 1.05;
  if (month >= 6 && month <= 8) return 1.02;
  return 1.0;
}

function getDaysOnMarket(listing: Listing): number | null {
  if (!listing.firstSeenAt) return null;
  const ms = Date.now() - new Date(listing.firstSeenAt).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function scoreDeal(
  listing: Listing,
  marketValue: MarketValueResult | null,
  snapshots: ListingSnapshot[]
): ScoringResult {
  const reasons: string[] = [];
  let priceAdvantage = 0;
  let mileageAdvantage = 0;
  let localDemand = 0;
  let reliability = 0;
  let sellerQuality = 0;
  let priceDropSignal = 0;

  const confidence = marketValue?.confidence ?? 0;

  // ── Price Advantage (0-40) ─ confidence-weighted so thin-comp "savings" can't
  // inflate the score. Full points require both a real discount AND real evidence.
  if (marketValue && listing.price) {
    const savings = marketValue.marketValueEst - listing.price;
    const savingsPct = savings / marketValue.marketValueEst;
    // Weight: 50% base credit for having any market value + 50% scaled by confidence
    const evidenceWeight = 0.5 + 0.5 * confidence;

    let rawPriceScore = 0;
    if (savingsPct > 0.15) {
      rawPriceScore = 40;
      reasons.push(
        `Priced $${Math.round(savings).toLocaleString()} below estimated market value (${Math.round(savingsPct * 100)}% discount, ${marketValue.compCount} comps)`
      );
    } else if (savingsPct > 0.08) {
      rawPriceScore = 30;
      reasons.push(
        `Priced $${Math.round(savings).toLocaleString()} below market value (${marketValue.compCount} comps)`
      );
    } else if (savingsPct > 0.03) {
      rawPriceScore = 18;
      reasons.push("Priced slightly below market median");
    } else if (savingsPct >= 0) {
      rawPriceScore = 8;
    } else {
      rawPriceScore = Math.max(0, 8 + savingsPct * 100);
      reasons.push(`Priced ${Math.round(Math.abs(savingsPct) * 100)}% above market median`);
    }
    priceAdvantage = Math.round(rawPriceScore * evidenceWeight);

    if (confidence < 0.4 && rawPriceScore >= 30) {
      reasons.push("Low comp confidence — verify pricing before acting");
    }
  } else {
    reasons.push("Insufficient comparable sales — no market value estimate");
  }

  // ── Mileage (0-15) ─ only credited when we have comps to compare against
  if (listing.mileage && marketValue && marketValue.compCount > 0) {
    if (listing.mileage < 50000) {
      mileageAdvantage = 15;
      reasons.push("Low mileage vehicle");
    } else if (listing.mileage < 80000) {
      mileageAdvantage = 10;
    } else if (listing.mileage < 120000) {
      mileageAdvantage = 4;
    }
  }

  // ── Local Demand (0-15) ─ neutral baseline of 5; only true demand signals add points
  const makeModelKey = `${listing.make.toLowerCase()}_${listing.model.toLowerCase()}`;
  const demandBoost = SA_DEMAND_BOOSTS[makeModelKey] || 0;
  const demandPenalty = SA_DEMAND_PENALTIES[makeModelKey] || 0;
  localDemand = Math.max(0, Math.min(15, 5 + demandBoost + demandPenalty));
  if (demandBoost > 0) {
    localDemand = Math.min(15, localDemand * getSeasonalFactor());
    reasons.push(`High local demand for ${listing.make} ${listing.model} in the San Antonio market`);
  }
  if (demandPenalty < 0) {
    reasons.push("Slower-moving segment in San Antonio");
  }
  localDemand = Math.round(localDemand);

  // ── Reliability (0-10) ─ unknown models get 4, not a free 5
  const reliabilityScore = RELIABILITY_SCORES[makeModelKey];
  if (reliabilityScore != null) {
    reliability = Math.round((reliabilityScore / 100) * 10);
    if (reliabilityScore >= 85) {
      reasons.push(`Excellent reliability rating for ${listing.make} ${listing.model} — resells easier`);
    }
  } else {
    reliability = 4;
  }

  // ── Seller Quality (0-10)
  if (listing.isDealer) {
    sellerQuality = 7;
  } else {
    sellerQuality = 5;
    reasons.push("Private seller — typically more negotiation room");
  }

  // ── Price Drop Signal (0-10)
  let totalDrop = 0;
  if (snapshots.length > 1) {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.snapshotAt!).getTime() - new Date(b.snapshotAt!).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.price && last.price && last.price < first.price) {
      totalDrop = first.price - last.price;
      const dropPct = totalDrop / first.price;
      priceDropSignal = Math.min(10, Math.round(dropPct * 100));
      reasons.push(
        `Price dropped $${Math.round(totalDrop).toLocaleString()} since first seen — motivated seller`
      );
    }
  }

  // ── Days on market: stale listings = leverage, fresh underpriced = urgency
  const daysOnMarket = getDaysOnMarket(listing);
  if (daysOnMarket != null && daysOnMarket >= 30) {
    reasons.push(`On market ${daysOnMarket} days — seller likely open to lower offers`);
  }

  let rawScore =
    priceAdvantage + mileageAdvantage + localDemand + reliability + sellerQuality + priceDropSignal;

  if (listing.titleStatus === "salvage" || listing.titleStatus === "rebuilt") {
    rawScore *= 0.4;
    reasons.push("Heavy penalty: salvage/rebuilt title — hard to finance and resell");
  }

  const dealScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // ── Offers anchored to MARKET VALUE, never the seller's ask.
  // Wholesale ≈ 88% of true market value; target offer sits between the two,
  // pulled down when the listing has been sitting or the price is already dropping.
  const anchor = marketValue?.marketValueEst ?? listing.price ?? 0;
  const wholesaleEstimate = Math.round(anchor * 0.88);

  let suggestedOffer = 0;
  if (listing.price && anchor > 0) {
    const staleness = daysOnMarket != null ? Math.min(daysOnMarket / 60, 1) : 0;
    const dropLeverage = totalDrop > 0 ? 0.02 : 0;
    // Base: 94% of market value, discounted up to 4% for staleness + 2% for active drops
    let offer = anchor * (0.94 - 0.04 * staleness - dropLeverage);
    // Never suggest paying more than the asking price
    offer = Math.min(offer, listing.price);
    suggestedOffer = Math.round(offer);
  }

  // ── Velocity: how fast this deal disappears (no filler constants)
  const dealHeat = priceAdvantage / 40;         // discount pulls buyers
  const demandHeat = localDemand / 15;          // local appetite
  const mileageHeat = Math.max(0, Math.min(1, (120000 - (listing.mileage ?? 90000)) / 120000));
  const freshHeat = daysOnMarket != null ? Math.max(0, 1 - daysOnMarket / 45) : 0.5;
  const velocityPrediction = Math.min(
    99,
    Math.max(5, Math.round((0.45 * dealHeat + 0.25 * demandHeat + 0.15 * mileageHeat + 0.15 * freshHeat) * 100))
  );

  // ── Urgency tier: what should the user actually DO with this lead
  let urgency: UrgencyTier = "monitor";
  const fresh = daysOnMarket != null && daysOnMarket <= 3;
  if (listing.titleStatus === "salvage" || listing.titleStatus === "rebuilt") {
    urgency = "pass";
  } else if (dealScore >= 80 && confidence >= 0.5 && fresh) {
    urgency = "act_now";
    reasons.push("Fresh, verified, deeply underpriced — deals like this go in days");
  } else if (dealScore >= 75 && confidence >= 0.4) {
    urgency = "strong_lead";
  } else if (dealScore >= 55 && (priceDropSignal > 0 || (daysOnMarket ?? 0) >= 30)) {
    urgency = "negotiate";
  } else if (dealScore < 40) {
    urgency = "pass";
  }

  return {
    dealScore,
    scoreBreakdown: {
      priceAdvantage,
      mileageAdvantage,
      localDemand,
      reliability,
      sellerQuality,
      priceDropSignal,
    },
    scoreReasons: reasons,
    velocityPrediction,
    wholesaleEstimate,
    suggestedOffer,
    urgency,
    daysOnMarket,
  };
}
