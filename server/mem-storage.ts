import type {
  Listing,
  InsertListing,
  ListingSnapshot,
  ListingDuplicate,
  DealScore,
  MarketCompsSummary,
  JobRun,
} from "@shared/schema";
import type { IStorage } from "./storage";

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return a.toLowerCase() === b.toLowerCase();
}

// In-memory fallback used when DATABASE_URL is not configured. Data does not
// survive restarts; it exists so the app can boot and demo without Postgres.
export class MemStorage implements IStorage {
  private listings: Listing[] = [];
  private snapshots: ListingSnapshot[] = [];
  private duplicates: ListingDuplicate[] = [];
  private dealScores: DealScore[] = [];
  private marketComps: MarketCompsSummary[] = [];
  private jobRuns: JobRun[] = [];
  private nextId = 1;

  private id(): number {
    return this.nextId++;
  }

  async insertListing(data: InsertListing): Promise<Listing> {
    const now = new Date();
    const row: Listing = {
      id: this.id(),
      source: data.source,
      externalId: data.externalId ?? null,
      vin: data.vin ?? null,
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim ?? null,
      bodyType: data.bodyType ?? null,
      price: data.price ?? null,
      mileage: data.mileage ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postalCode: data.postalCode ?? null,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      dealerName: data.dealerName ?? null,
      isDealer: data.isDealer ?? false,
      listingUrl: data.listingUrl ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
      titleStatus: data.titleStatus ?? "clean",
      imageUrls: data.imageUrls ?? [],
      rawPayload: data.rawPayload ?? null,
    };
    this.listings.push(row);
    return row;
  }

  async updateListingLastSeen(id: number): Promise<void> {
    const row = this.listings.find((l) => l.id === id);
    if (row) row.lastSeenAt = new Date();
  }

  async getListingById(id: number): Promise<Listing | undefined> {
    return this.listings.find((l) => l.id === id);
  }

  async getAllListings(): Promise<Listing[]> {
    return [...this.listings];
  }

  async getListingsByMakeModel(make: string, model: string): Promise<Listing[]> {
    return this.listings.filter(
      (l) => sameText(l.make, make) && sameText(l.model, model)
    );
  }

  async getListingsByCity(city: string): Promise<Listing[]> {
    return this.listings.filter((l) => sameText(l.city, city));
  }

  async getListingsCount(): Promise<number> {
    return this.listings.length;
  }

  async insertSnapshot(listingId: number, price: number | null, mileage: number | null): Promise<void> {
    this.snapshots.push({
      id: this.id(),
      listingId,
      price,
      mileage,
      snapshotAt: new Date(),
    });
  }

  async getSnapshotsForListing(listingId: number): Promise<ListingSnapshot[]> {
    return this.snapshots
      .filter((s) => s.listingId === listingId)
      .sort((a, b) => (a.snapshotAt?.getTime() ?? 0) - (b.snapshotAt?.getTime() ?? 0));
  }

  async getPriceDropCount24h(): Promise<number> {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const ids = new Set(
      this.snapshots
        .filter((s) => (s.snapshotAt?.getTime() ?? 0) >= oneDayAgo)
        .map((s) => s.listingId)
    );
    return ids.size;
  }

  async insertDuplicate(canonicalId: number, duplicateId: number, matchType: string): Promise<void> {
    this.duplicates.push({
      id: this.id(),
      canonicalListingId: canonicalId,
      duplicateListingId: duplicateId,
      matchType,
      detectedAt: new Date(),
    });
  }

  async upsertDealScore(data: {
    listingId: number;
    dealScore: number;
    marketValueEst: number | null;
    compCount: number | null;
    compPriceMedian: number | null;
    confidence: number | null;
    savingsAmount: number | null;
    scoreBreakdown: any;
    scoreReasons: string[];
    velocityPrediction: number | null;
    wholesaleEstimate: number | null;
    suggestedOffer: number | null;
  }): Promise<void> {
    const existing = this.dealScores.find((d) => d.listingId === data.listingId);
    if (existing) {
      Object.assign(existing, data, { scoredAt: new Date() });
    } else {
      this.dealScores.push({
        id: this.id(),
        ...data,
        scoredAt: new Date(),
      });
    }
  }

  async getTopDeals(minScore: number, limit: number): Promise<(Listing & { score: DealScore })[]> {
    return this.dealScores
      .filter((d) => d.dealScore >= minScore)
      .sort((a, b) => b.dealScore - a.dealScore)
      .slice(0, limit)
      .flatMap((score) => {
        const listing = this.listings.find((l) => l.id === score.listingId);
        return listing ? [{ ...listing, score }] : [];
      });
  }

  async getDealScoreForListing(listingId: number): Promise<DealScore | undefined> {
    return this.dealScores.find((d) => d.listingId === listingId);
  }

  async upsertMarketComps(data: {
    city: string;
    vehicleSegment: string;
    make?: string | null;
    model?: string | null;
    medianPrice?: number | null;
    inventoryCount?: number | null;
    avgDaysOnMarket?: number | null;
    priceChange30d?: number | null;
    demandVelocity?: string | null;
  }): Promise<void> {
    const existing = this.marketComps.find(
      (c) =>
        sameText(c.city, data.city) &&
        sameText(c.vehicleSegment, data.vehicleSegment) &&
        (data.make ? sameText(c.make, data.make) : c.make == null) &&
        (data.model ? sameText(c.model, data.model) : c.model == null)
    );

    if (existing) {
      existing.medianPrice = data.medianPrice ?? null;
      existing.inventoryCount = data.inventoryCount ?? null;
      existing.avgDaysOnMarket = data.avgDaysOnMarket ?? null;
      existing.priceChange30d = data.priceChange30d ?? null;
      existing.demandVelocity = data.demandVelocity ?? null;
      existing.createdAt = new Date();
    } else {
      this.marketComps.push({
        id: this.id(),
        city: data.city,
        vehicleSegment: data.vehicleSegment,
        make: data.make ?? null,
        model: data.model ?? null,
        medianPrice: data.medianPrice ?? null,
        inventoryCount: data.inventoryCount ?? null,
        avgDaysOnMarket: data.avgDaysOnMarket ?? null,
        priceChange30d: data.priceChange30d ?? null,
        demandVelocity: data.demandVelocity ?? null,
        createdAt: new Date(),
      });
    }
  }

  async getMarketComps(city: string): Promise<MarketCompsSummary[]> {
    return this.marketComps.filter((c) => sameText(c.city, city));
  }

  async getMarketCompsByMakeModel(city: string, make: string, model: string): Promise<MarketCompsSummary | undefined> {
    return this.marketComps.find(
      (c) => sameText(c.city, city) && sameText(c.make, make) && sameText(c.model, model)
    );
  }

  async insertJobRun(jobType: string): Promise<JobRun> {
    const row: JobRun = {
      id: this.id(),
      jobType,
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      recordsProcessed: 0,
      errors: [],
    };
    this.jobRuns.push(row);
    return row;
  }

  async completeJobRun(id: number, recordsProcessed: number, errors: string[]): Promise<void> {
    const row = this.jobRuns.find((j) => j.id === id);
    if (row) {
      row.status = errors.length > 0 ? "completed_with_errors" : "completed";
      row.completedAt = new Date();
      row.recordsProcessed = recordsProcessed;
      row.errors = errors;
    }
  }
}
