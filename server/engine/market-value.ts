import type { Listing } from "@shared/schema";
import { SA_CENTROID, haversineDistance } from "./constants";

export interface MarketValueResult {
  marketValueEst: number;
  compCount: number;
  compPriceMedian: number;
  confidence: number;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length;
}

export function estimateMarketValue(
  listing: Listing,
  allListings: Listing[]
): MarketValueResult | null {
  if (!listing.price || !listing.mileage) return null;

  const comps = allListings.filter((comp) => {
    if (comp.id === listing.id) return false;
    if (comp.make.toLowerCase() !== listing.make.toLowerCase()) return false;
    if (comp.model.toLowerCase() !== listing.model.toLowerCase()) return false;
    if (!comp.price || !comp.mileage) return false;
    if (Math.abs(comp.year - listing.year) > 1) return false;

    const mileageDiff = Math.abs(comp.mileage - listing.mileage) / listing.mileage;
    if (mileageDiff > 0.2) return false;

    if (comp.lat && comp.lon) {
      const dist = haversineDistance(
        SA_CENTROID.lat, SA_CENTROID.lon,
        comp.lat, comp.lon
      );
      if (dist > 100) return false;
    }

    return true;
  });

  if (comps.length < 2) return null;

  const prices = comps.map((c) => c.price!);
  const medianPrice = median(prices);

  const depreciationPerMile = 0.05;
  const avgCompMileage = comps.reduce((s, c) => s + c.mileage!, 0) / comps.length;
  const mileageDiff = listing.mileage - avgCompMileage;
  const mileageAdjustment = -(mileageDiff / 10000) * depreciationPerMile * medianPrice;

  let trimAdjustment = 0;
  if (listing.trim) {
    const trimComps = comps.filter(
      (c) => c.trim && c.trim.toLowerCase() === listing.trim!.toLowerCase()
    );
    if (trimComps.length >= 2) {
      const trimMedian = median(trimComps.map((c) => c.price!));
      trimAdjustment = (trimMedian - medianPrice) * 0.3;
    }
  }

  const marketValueEst = Math.round(medianPrice + mileageAdjustment + trimAdjustment);

  const priceVariance = variance(prices);
  const cv = Math.sqrt(priceVariance) / medianPrice;
  const compCountFactor = Math.min(comps.length / 15, 1);
  const varianceFactor = Math.max(1 - cv * 2, 0);
  const confidence = Math.round(Math.min(compCountFactor * 0.6 + varianceFactor * 0.4, 1) * 100) / 100;

  return {
    marketValueEst: Math.max(marketValueEst, 0),
    compCount: comps.length,
    compPriceMedian: Math.round(medianPrice),
    confidence,
  };
}
