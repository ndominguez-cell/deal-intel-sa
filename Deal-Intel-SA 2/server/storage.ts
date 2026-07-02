import {
  listings,
  listingSnapshots,
  listingDuplicates,
  dealScores,
  marketCompsSummary,
  jobsRuns,
  type Listing,
  type InsertListing,
  type ListingSnapshot,
  type DealScore,
  type MarketCompsSummary,
  type JobRun,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, and, sql, lte, ilike } from "drizzle-orm";

export interface IStorage {
  insertListing(data: InsertListing): Promise<Listing>;
  updateListingLastSeen(id: number): Promise<void>;
  getListingById(id: number): Promise<Listing | undefined>;
  getAllListings(): Promise<Listing[]>;
  getListingsByMakeModel(make: string, model: string): Promise<Listing[]>;
  getListingsByCity(city: string, radiusMiles?: number): Promise<Listing[]>;
  getListingsCount(): Promise<number>;

  insertSnapshot(listingId: number, price: number | null, mileage: number | null): Promise<void>;
  getSnapshotsForListing(listingId: number): Promise<ListingSnapshot[]>;
  getPriceDropCount24h(): Promise<number>;

  insertDuplicate(canonicalId: number, duplicateId: number, matchType: string): Promise<void>;

  upsertDealScore(data: {
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
  }): Promise<void>;
  getTopDeals(minScore: number, limit: number): Promise<(Listing & { score: DealScore })[]>;
  getDealScoreForListing(listingId: number): Promise<DealScore | undefined>;

  upsertMarketComps(data: {
    city: string;
    vehicleSegment: string;
    make?: string | null;
    model?: string | null;
    medianPrice?: number | null;
    inventoryCount?: number | null;
    avgDaysOnMarket?: number | null;
    priceChange30d?: number | null;
    demandVelocity?: string | null;
  }): Promise<void>;
  getMarketComps(city: string): Promise<MarketCompsSummary[]>;
  getMarketCompsByMakeModel(city: string, make: string, model: string): Promise<MarketCompsSummary | undefined>;

  insertJobRun(jobType: string): Promise<JobRun>;
  completeJobRun(id: number, recordsProcessed: number, errors: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async insertListing(data: InsertListing): Promise<Listing> {
    const [row] = await db.insert(listings).values(data).returning();
    return row;
  }

  async updateListingLastSeen(id: number): Promise<void> {
    await db.update(listings).set({ lastSeenAt: new Date() }).where(eq(listings.id, id));
  }

  async getListingById(id: number): Promise<Listing | undefined> {
    const [row] = await db.select().from(listings).where(eq(listings.id, id));
    return row;
  }

  async getAllListings(): Promise<Listing[]> {
    return db.select().from(listings);
  }

  async getListingsByMakeModel(make: string, model: string): Promise<Listing[]> {
    return db
      .select()
      .from(listings)
      .where(and(ilike(listings.make, make), ilike(listings.model, model)));
  }

  async getListingsByCity(city: string): Promise<Listing[]> {
    return db.select().from(listings).where(ilike(listings.city, city));
  }

  async getListingsCount(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings);
    return count;
  }

  async insertSnapshot(listingId: number, price: number | null, mileage: number | null): Promise<void> {
    await db.insert(listingSnapshots).values({ listingId, price, mileage });
  }

  async getSnapshotsForListing(listingId: number): Promise<ListingSnapshot[]> {
    return db
      .select()
      .from(listingSnapshots)
      .where(eq(listingSnapshots.listingId, listingId))
      .orderBy(listingSnapshots.snapshotAt);
  }

  async getPriceDropCount24h(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ count }] = await db
      .select({ count: sql<number>`count(distinct ${listingSnapshots.listingId})::int` })
      .from(listingSnapshots)
      .where(gte(listingSnapshots.snapshotAt, oneDayAgo));
    return count;
  }

  async insertDuplicate(canonicalId: number, duplicateId: number, matchType: string): Promise<void> {
    await db.insert(listingDuplicates).values({
      canonicalListingId: canonicalId,
      duplicateListingId: duplicateId,
      matchType,
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
    await db
      .insert(dealScores)
      .values({
        ...data,
        scoredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dealScores.listingId,
        set: {
          dealScore: data.dealScore,
          marketValueEst: data.marketValueEst,
          compCount: data.compCount,
          compPriceMedian: data.compPriceMedian,
          confidence: data.confidence,
          savingsAmount: data.savingsAmount,
          scoreBreakdown: data.scoreBreakdown,
          scoreReasons: data.scoreReasons,
          velocityPrediction: data.velocityPrediction,
          wholesaleEstimate: data.wholesaleEstimate,
          suggestedOffer: data.suggestedOffer,
          scoredAt: new Date(),
        },
      });
  }

  async getTopDeals(minScore: number, limit: number): Promise<(Listing & { score: DealScore })[]> {
    const rows = await db
      .select()
      .from(dealScores)
      .innerJoin(listings, eq(dealScores.listingId, listings.id))
      .where(gte(dealScores.dealScore, minScore))
      .orderBy(desc(dealScores.dealScore))
      .limit(limit);

    return rows.map((r) => ({
      ...r.listings,
      score: r.deal_scores,
    }));
  }

  async getDealScoreForListing(listingId: number): Promise<DealScore | undefined> {
    const [row] = await db
      .select()
      .from(dealScores)
      .where(eq(dealScores.listingId, listingId));
    return row;
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
    const existing = await db
      .select()
      .from(marketCompsSummary)
      .where(
        and(
          ilike(marketCompsSummary.city, data.city),
          ilike(marketCompsSummary.vehicleSegment, data.vehicleSegment),
          data.make ? ilike(marketCompsSummary.make!, data.make) : sql`${marketCompsSummary.make} IS NULL`,
          data.model ? ilike(marketCompsSummary.model!, data.model) : sql`${marketCompsSummary.model} IS NULL`
        )
      );

    if (existing.length > 0) {
      await db
        .update(marketCompsSummary)
        .set({
          medianPrice: data.medianPrice,
          inventoryCount: data.inventoryCount,
          avgDaysOnMarket: data.avgDaysOnMarket,
          priceChange30d: data.priceChange30d,
          demandVelocity: data.demandVelocity,
          createdAt: new Date(),
        })
        .where(eq(marketCompsSummary.id, existing[0].id));
    } else {
      await db.insert(marketCompsSummary).values({
        ...data,
        createdAt: new Date(),
      });
    }
  }

  async getMarketComps(city: string): Promise<MarketCompsSummary[]> {
    return db
      .select()
      .from(marketCompsSummary)
      .where(ilike(marketCompsSummary.city, city));
  }

  async getMarketCompsByMakeModel(city: string, make: string, model: string): Promise<MarketCompsSummary | undefined> {
    const [row] = await db
      .select()
      .from(marketCompsSummary)
      .where(
        and(
          ilike(marketCompsSummary.city, city),
          ilike(marketCompsSummary.make!, make),
          ilike(marketCompsSummary.model!, model)
        )
      );
    return row;
  }

  async insertJobRun(jobType: string): Promise<JobRun> {
    const [row] = await db
      .insert(jobsRuns)
      .values({ jobType, status: "running" })
      .returning();
    return row;
  }

  async completeJobRun(id: number, recordsProcessed: number, errors: string[]): Promise<void> {
    await db
      .update(jobsRuns)
      .set({
        status: errors.length > 0 ? "completed_with_errors" : "completed",
        completedAt: new Date(),
        recordsProcessed,
        errors,
      })
      .where(eq(jobsRuns.id, id));
  }
}

export const storage = new DatabaseStorage();
