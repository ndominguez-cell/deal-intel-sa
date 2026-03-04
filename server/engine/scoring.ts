import type { Listing, ListingSnapshot } from "@shared/schema";
import {
  RELIABILITY_SCORES,
  SA_DEMAND_BOOSTS,
  SA_DEMAND_PENALTIES,
} from "./constants";
import type { MarketValueResult } from "./market-value";

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
}

function getSeasonalFactor(): number {
  const month = new Date().getMonth() + 1;
  if (month >= 2 && month <= 4) return 1.05;
  if (month >= 6 && month <= 8) return 1.02;
  return 1.0;
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

  if (marketValue && listing.price) {
    const savings = marketValue.marketValueEst - listing.price;
    const savingsPct = savings / marketValue.marketValueEst;

    if (savingsPct > 0.15) {
      priceAdvantage = 40;
      reasons.push(`Price is $${Math.round(savings).toLocaleString()} below estimated market value (${Math.round(savingsPct * 100)}% savings)`);
    } else if (savingsPct > 0.08) {
      priceAdvantage = 30;
      reasons.push(`Price is $${Math.round(savings).toLocaleString()} below market value`);
    } else if (savingsPct > 0.03) {
      priceAdvantage = 20;
      reasons.push(`Priced slightly below market median`);
    } else if (savingsPct >= 0) {
      priceAdvantage = 10;
    } else {
      priceAdvantage = Math.max(0, 10 + savingsPct * 100);
      reasons.push(`Priced above market median`);
    }
  }

  if (listing.mileage && marketValue && marketValue.compCount > 0) {
    if (listing.mileage < 50000) {
      mileageAdvantage = 15;
      reasons.push("Low mileage vehicle");
    } else if (listing.mileage < 80000) {
      mileageAdvantage = 10;
    } else if (listing.mileage < 120000) {
      mileageAdvantage = 5;
    } else {
      mileageAdvantage = 0;
    }
  }

  const makeModelKey = `${listing.make.toLowerCase()}_${listing.model.toLowerCase()}`;
  const demandBoost = SA_DEMAND_BOOSTS[makeModelKey] || 0;
  const demandPenalty = SA_DEMAND_PENALTIES[makeModelKey] || 0;
  localDemand = Math.max(0, Math.min(15, 7.5 + demandBoost + demandPenalty));

  const seasonal = getSeasonalFactor();
  localDemand = Math.min(15, localDemand * seasonal);

  if (demandBoost > 0) {
    reasons.push(`High local demand for ${listing.make} ${listing.model} in San Antonio area`);
  }
  if (demandPenalty < 0) {
    reasons.push(`Lower local demand for this segment in San Antonio`);
  }

  const reliabilityScore = RELIABILITY_SCORES[makeModelKey];
  if (reliabilityScore != null) {
    reliability = Math.round((reliabilityScore / 100) * 10);
    if (reliabilityScore >= 85) {
      reasons.push(`Excellent reliability rating for ${listing.make} ${listing.model}`);
    }
  } else {
    reliability = 5;
  }

  if (listing.isDealer) {
    sellerQuality = 8;
    reasons.push("Dealer listing - generally more transparent");
  } else {
    sellerQuality = 5;
    reasons.push("Private seller - potential negotiation room");
  }

  if (snapshots.length > 1) {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.snapshotAt!).getTime() - new Date(b.snapshotAt!).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.price && last.price && last.price < first.price) {
      const dropPct = (first.price - last.price) / first.price;
      priceDropSignal = Math.min(10, Math.round(dropPct * 100));
      reasons.push(
        `Price dropped $${Math.round(first.price - last.price).toLocaleString()} since first seen`
      );
    }
  }

  let rawScore =
    priceAdvantage + mileageAdvantage + localDemand + reliability + sellerQuality + priceDropSignal;

  if (listing.titleStatus === "salvage" || listing.titleStatus === "rebuilt") {
    rawScore *= 0.4;
    reasons.push("Heavy penalty: salvage/rebuilt title");
  }

  const dealScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const wholesaleEstimate = listing.price
    ? Math.round(listing.price * 0.88)
    : 0;

  const suggestedOffer = listing.price
    ? Math.round(listing.price * 0.93)
    : 0;

  const velocityPrediction = Math.min(
    99,
    Math.max(
      5,
      Math.round(
        0.35 * (priceAdvantage / 40) * 100 +
        0.20 * (localDemand / 15) * 100 +
        0.15 * Math.max(0, 50 - (listing.mileage || 50000) / 1000) +
        0.15 * (sellerQuality / 10) * 100 +
        0.15 * 50
      )
    )
  );

  return {
    dealScore,
    scoreBreakdown: {
      priceAdvantage,
      mileageAdvantage,
      localDemand: Math.round(localDemand),
      reliability,
      sellerQuality,
      priceDropSignal,
    },
    scoreReasons: reasons,
    velocityPrediction,
    wholesaleEstimate,
    suggestedOffer,
  };
}
