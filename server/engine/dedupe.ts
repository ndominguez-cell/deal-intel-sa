import type { Listing } from "@shared/schema";

export interface DupeResult {
  isDuplicate: boolean;
  canonicalId: number | null;
  matchType: string;
}

export function checkDuplicate(
  incoming: { vin?: string | null; source: string; externalId?: string | null; year: number; make: string; model: string; trim?: string | null; city?: string | null; price?: number | null; mileage?: number | null; listingUrl?: string | null },
  existing: Listing[]
): DupeResult {
  if (incoming.vin && incoming.vin.length >= 11) {
    const vinMatch = existing.find((e) => {
      if (!e.vin || e.vin !== incoming.vin) return false;
      if (incoming.price && e.price) {
        const priceDiff = Math.abs(incoming.price - e.price) / e.price;
        if (priceDiff > 0.2) return false;
      }
      if (incoming.mileage && e.mileage) {
        const mileageDiff = Math.abs(incoming.mileage - e.mileage);
        if (mileageDiff > 10000) return false;
      }
      return true;
    });
    if (vinMatch) {
      return { isDuplicate: true, canonicalId: vinMatch.id, matchType: "vin_match" };
    }
  }

  if (incoming.source && incoming.externalId) {
    const srcMatch = existing.find(
      (e) => e.source === incoming.source && e.externalId === incoming.externalId
    );
    if (srcMatch) {
      return { isDuplicate: true, canonicalId: srcMatch.id, matchType: "source_external_id" };
    }
  }

  const fuzzyMatch = existing.find((e) => {
    if (e.year !== incoming.year) return false;
    if (e.make.toLowerCase() !== incoming.make.toLowerCase()) return false;
    if (e.model.toLowerCase() !== incoming.model.toLowerCase()) return false;
    if (incoming.trim && e.trim && e.trim.toLowerCase() !== incoming.trim.toLowerCase()) return false;
    if (incoming.city && e.city && e.city.toLowerCase() !== incoming.city.toLowerCase()) return false;
    if (incoming.price && e.price) {
      const priceDiff = Math.abs(incoming.price - e.price) / e.price;
      if (priceDiff > 0.1) return false;
    }
    if (incoming.listingUrl && e.listingUrl && incoming.listingUrl === e.listingUrl) return true;
    return false;
  });

  if (fuzzyMatch) {
    return { isDuplicate: true, canonicalId: fuzzyMatch.id, matchType: "fuzzy_match" };
  }

  return { isDuplicate: false, canonicalId: null, matchType: "" };
}
