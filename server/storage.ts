import {
  listings,
  listingSnapshots,
  listingDuplicates,
  dealScores,
  marketCompsSummary,
  jobsRuns,
  leads,
  buyerLeads,
  appointments,
  type Listing,
  type InsertListing,
  type ListingSnapshot,
  type DealScore,
  type MarketCompsSummary,
  type JobRun,
  type Lead,
  type BuyerLead,
  type Appointment,
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
    urgency?: string | null;
    daysOnMarket?: number | null;
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

  upsertLead(data: {
    listingId: number;
    priceAtSave: number | null;
    scoreAtSave: number | null;
    scoreBreakdownAtSave?: DealScore["scoreBreakdown"] | null;
    urgencyAtSave?: string | null;
  }): Promise<Lead>;
  updateLead(id: number, updates: { status?: string; notes?: string }): Promise<Lead | undefined>;
  getLeads(status?: string): Promise<(Lead & { listing: Listing; score: DealScore | null })[]>;
  getLeadsWithOutcomes(): Promise<Lead[]>;
  deleteLead(id: number): Promise<void>;

  insertBuyerLead(data: Omit<BuyerLead, "id" | "createdAt" | "status" | "smsOptOut">): Promise<BuyerLead>;
  getBuyerLeads(status?: string): Promise<(BuyerLead & { listing: Listing | null })[]>;
  updateBuyerLeadStatus(id: number, status: string): Promise<BuyerLead | undefined>;

  insertAppointment(data: {
    buyerLeadId: number;
    listingId: number | null;
    dealerName: string | null;
    scheduledAt: Date;
    setBy: string;
    notes?: string | null;
    dealScoreAtBooking?: number | null;
    scoreBreakdownAtBooking?: DealScore["scoreBreakdown"] | null;
    urgencyAtBooking?: string | null;
  }): Promise<Appointment>;
  getAppointments(filters?: { status?: string; dealerName?: string; from?: Date; to?: Date }): Promise<(Appointment & { buyerLead: BuyerLead | null; listing: Listing | null })[]>;
  getAppointmentsWithOutcomes(): Promise<Appointment[]>;
  getAppointmentById(id: number): Promise<(Appointment & { buyerLead: BuyerLead | null; listing: Listing | null }) | undefined>;
  getBookedSlotTimes(dealerName: string | null, from: Date, to: Date): Promise<Date[]>;
  updateAppointmentStatus(id: number, status: string, notes?: string | null): Promise<Appointment | undefined>;
  getBuyerLeadById(id: number): Promise<BuyerLead | undefined>;

  // SMS
  updateAppointmentSmsStatus(id: number, kind: "confirmation" | "reminder", status: "sent" | "skipped" | "failed"): Promise<void>;
  getAppointmentsNeedingReminders(from: Date, to: Date): Promise<(Appointment & { buyerLead: BuyerLead | null; listing: Listing | null })[]>;
  setSmsOptOutByPhone(phone: string, optOut: boolean): Promise<void>;

  // Dealer notification
  updateAppointmentDealerNotifyStatus(id: number, status: "sent" | "skipped" | "failed"): Promise<void>;
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
    urgency?: string | null;
    daysOnMarket?: number | null;
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
          urgency: data.urgency ?? "monitor",
          daysOnMarket: data.daysOnMarket ?? null,
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

  async upsertLead(data: {
    listingId: number;
    priceAtSave: number | null;
    scoreAtSave: number | null;
    scoreBreakdownAtSave?: DealScore["scoreBreakdown"] | null;
    urgencyAtSave?: string | null;
  }): Promise<Lead> {
    const [row] = await db
      .insert(leads)
      .values({
        listingId: data.listingId,
        priceAtSave: data.priceAtSave,
        scoreAtSave: data.scoreAtSave,
        scoreBreakdownAtSave: data.scoreBreakdownAtSave ?? null,
        urgencyAtSave: data.urgencyAtSave ?? null,
      })
      .onConflictDoUpdate({
        target: leads.listingId,
        set: { updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async updateLead(id: number, updates: { status?: string; notes?: string }): Promise<Lead | undefined> {
    const [row] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return row;
  }

  async getLeads(status?: string): Promise<(Lead & { listing: Listing; score: DealScore | null })[]> {
    const rows = await db
      .select()
      .from(leads)
      .innerJoin(listings, eq(leads.listingId, listings.id))
      .leftJoin(dealScores, eq(leads.listingId, dealScores.listingId))
      .where(status ? eq(leads.status, status) : sql`true`)
      .orderBy(desc(leads.updatedAt));

    return rows.map((r: any) => ({
      ...r.leads,
      listing: r.listings,
      score: r.deal_scores ?? null,
    }));
  }

  async deleteLead(id: number): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  // Won/lost leads only — the calibration report's input. Plain rows (no
  // joins needed) since everything it needs was snapshotted at save time.
  async getLeadsWithOutcomes(): Promise<Lead[]> {
    return db
      .select()
      .from(leads)
      .where(sql`${leads.status} IN ('won', 'lost')`);
  }

  async insertBuyerLead(data: Omit<BuyerLead, "id" | "createdAt" | "status" | "smsOptOut">): Promise<BuyerLead> {
    const [row] = await db.insert(buyerLeads).values(data).returning();
    return row;
  }

  async getBuyerLeads(status?: string): Promise<(BuyerLead & { listing: Listing | null })[]> {
    const rows = await db
      .select()
      .from(buyerLeads)
      .leftJoin(listings, eq(buyerLeads.listingId, listings.id))
      .where(status ? eq(buyerLeads.status, status) : sql`true`)
      .orderBy(desc(buyerLeads.createdAt));
    return rows.map((r: any) => ({ ...r.buyer_leads, listing: r.listings ?? null }));
  }

  async updateBuyerLeadStatus(id: number, status: string): Promise<BuyerLead | undefined> {
    const [row] = await db
      .update(buyerLeads)
      .set({ status })
      .where(eq(buyerLeads.id, id))
      .returning();
    return row;
  }

  async getBuyerLeadById(id: number): Promise<BuyerLead | undefined> {
    const [row] = await db.select().from(buyerLeads).where(eq(buyerLeads.id, id));
    return row;
  }

  async insertAppointment(data: {
    buyerLeadId: number;
    listingId: number | null;
    dealerName: string | null;
    scheduledAt: Date;
    setBy: string;
    notes?: string | null;
    dealScoreAtBooking?: number | null;
    scoreBreakdownAtBooking?: DealScore["scoreBreakdown"] | null;
    urgencyAtBooking?: string | null;
  }): Promise<Appointment> {
    const [row] = await db.insert(appointments).values({
      buyerLeadId: data.buyerLeadId,
      listingId: data.listingId,
      dealerName: data.dealerName,
      scheduledAt: data.scheduledAt,
      setBy: data.setBy,
      notes: data.notes ?? null,
      dealScoreAtBooking: data.dealScoreAtBooking ?? null,
      scoreBreakdownAtBooking: data.scoreBreakdownAtBooking ?? null,
      urgencyAtBooking: data.urgencyAtBooking ?? null,
    }).returning();
    // A booked appointment upgrades the lead's pipeline status automatically
    await db.update(buyerLeads).set({ status: "appointment" }).where(eq(buyerLeads.id, data.buyerLeadId));
    return row;
  }

  async getAppointments(filters?: { status?: string; dealerName?: string; from?: Date; to?: Date }): Promise<(Appointment & { buyerLead: BuyerLead | null; listing: Listing | null })[]> {
    const conditions = [
      filters?.status ? eq(appointments.status, filters.status) : sql`true`,
      filters?.dealerName ? ilike(appointments.dealerName!, filters.dealerName) : sql`true`,
      filters?.from ? gte(appointments.scheduledAt, filters.from) : sql`true`,
      filters?.to ? lte(appointments.scheduledAt, filters.to) : sql`true`,
    ];
    const rows = await db
      .select()
      .from(appointments)
      .leftJoin(buyerLeads, eq(appointments.buyerLeadId, buyerLeads.id))
      .leftJoin(listings, eq(appointments.listingId, listings.id))
      .where(and(...conditions))
      .orderBy(appointments.scheduledAt);
    return rows.map((r: any) => ({ ...r.appointments, buyerLead: r.buyer_leads ?? null, listing: r.listings ?? null }));
  }

  async getBookedSlotTimes(dealerName: string | null, from: Date, to: Date): Promise<Date[]> {
    const rows = await db
      .select({ scheduledAt: appointments.scheduledAt })
      .from(appointments)
      .where(
        and(
          gte(appointments.scheduledAt, from),
          lte(appointments.scheduledAt, to),
          dealerName ? ilike(appointments.dealerName!, dealerName) : sql`true`,
          sql`${appointments.status} != 'cancelled'`
        )
      );
    return rows.map((r) => r.scheduledAt);
  }

  async updateAppointmentStatus(id: number, status: string, notes?: string | null): Promise<Appointment | undefined> {
    const [row] = await db
      .update(appointments)
      .set({ status, ...(notes != null ? { notes } : {}), updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return row;
  }

  // Shown/no_show appointments only — the calibration report's input.
  async getAppointmentsWithOutcomes(): Promise<Appointment[]> {
    return db
      .select()
      .from(appointments)
      .where(sql`${appointments.status} IN ('shown', 'no_show')`);
  }

  async getAppointmentById(id: number): Promise<(Appointment & { buyerLead: BuyerLead | null; listing: Listing | null }) | undefined> {
    const [row] = await db
      .select()
      .from(appointments)
      .leftJoin(buyerLeads, eq(appointments.buyerLeadId, buyerLeads.id))
      .leftJoin(listings, eq(appointments.listingId, listings.id))
      .where(eq(appointments.id, id));
    if (!row) return undefined;
    const r: any = row;
    return { ...r.appointments, buyerLead: r.buyer_leads ?? null, listing: r.listings ?? null };
  }

  async updateAppointmentSmsStatus(id: number, kind: "confirmation" | "reminder", status: "sent" | "skipped" | "failed"): Promise<void> {
    const columnStatus = kind === "confirmation" ? "confirmationSmsStatus" : "reminderSmsStatus";
    const columnAt = kind === "confirmation" ? "confirmationSmsAt" : "reminderSmsAt";
    await db
      .update(appointments)
      .set({ [columnStatus]: status, [columnAt]: new Date(), updatedAt: new Date() } as any)
      .where(eq(appointments.id, id));
  }

  // Appointments 20-28h out (a rolling window, not an exact 24h instant, so a
  // sweep that runs every 15-30 min never misses one) whose reminder hasn't
  // gone out yet and that are still active (not cancelled/no_show).
  async getAppointmentsNeedingReminders(from: Date, to: Date): Promise<(Appointment & { buyerLead: BuyerLead | null; listing: Listing | null })[]> {
    const rows = await db
      .select()
      .from(appointments)
      .leftJoin(buyerLeads, eq(appointments.buyerLeadId, buyerLeads.id))
      .leftJoin(listings, eq(appointments.listingId, listings.id))
      .where(
        and(
          gte(appointments.scheduledAt, from),
          lte(appointments.scheduledAt, to),
          eq(appointments.reminderSmsStatus, "pending"),
          sql`${appointments.status} NOT IN ('cancelled', 'no_show')`
        )
      );
    return rows.map((r: any) => ({ ...r.appointments, buyerLead: r.buyer_leads ?? null, listing: r.listings ?? null }));
  }

  async setSmsOptOutByPhone(phone: string, optOut: boolean): Promise<void> {
    await db.update(buyerLeads).set({ smsOptOut: optOut }).where(eq(buyerLeads.phone, phone));
  }

  async updateAppointmentDealerNotifyStatus(id: number, status: "sent" | "skipped" | "failed"): Promise<void> {
    await db
      .update(appointments)
      .set({ dealerNotifyStatus: status, dealerNotifyAt: new Date(), updatedAt: new Date() })
      .where(eq(appointments.id, id));
  }
}

export const storage = new DatabaseStorage();
