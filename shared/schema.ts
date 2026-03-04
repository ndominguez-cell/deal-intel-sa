import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: text("external_id"),
    vin: text("vin"),
    year: integer("year").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),
    bodyType: text("body_type"),
    price: real("price"),
    mileage: integer("mileage"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    lat: real("lat"),
    lon: real("lon"),
    dealerName: text("dealer_name"),
    isDealer: boolean("is_dealer").default(false),
    listingUrl: text("listing_url"),
    firstSeenAt: timestamp("first_seen_at").defaultNow(),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
    titleStatus: text("title_status").default("clean"),
    imageUrls: jsonb("image_urls").$type<string[]>().default([]),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("listings_make_model_idx").on(table.make, table.model),
    index("listings_city_state_idx").on(table.city, table.state),
    index("listings_vin_idx").on(table.vin),
    index("listings_source_ext_idx").on(table.source, table.externalId),
  ]
);

export const listingSnapshots = pgTable(
  "listing_snapshots",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    price: real("price"),
    mileage: integer("mileage"),
    snapshotAt: timestamp("snapshot_at").defaultNow(),
  },
  (table) => [
    index("snapshots_listing_idx").on(table.listingId),
  ]
);

export const listingDuplicates = pgTable(
  "listing_duplicates",
  {
    id: serial("id").primaryKey(),
    canonicalListingId: integer("canonical_listing_id")
      .notNull()
      .references(() => listings.id),
    duplicateListingId: integer("duplicate_listing_id")
      .notNull()
      .references(() => listings.id),
    matchType: text("match_type").notNull(),
    detectedAt: timestamp("detected_at").defaultNow(),
  },
  (table) => [
    index("dupes_canonical_idx").on(table.canonicalListingId),
  ]
);

export const dealScores = pgTable(
  "deal_scores",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    dealScore: real("deal_score").notNull(),
    marketValueEst: real("market_value_est"),
    compCount: integer("comp_count"),
    compPriceMedian: real("comp_price_median"),
    confidence: real("confidence"),
    savingsAmount: real("savings_amount"),
    scoreBreakdown: jsonb("score_breakdown").$type<{
      priceAdvantage: number;
      mileageAdvantage: number;
      localDemand: number;
      reliability: number;
      sellerQuality: number;
      priceDropSignal: number;
    }>(),
    scoreReasons: jsonb("score_reasons").$type<string[]>().default([]),
    velocityPrediction: real("velocity_prediction"),
    wholesaleEstimate: real("wholesale_estimate"),
    suggestedOffer: real("suggested_offer"),
    scoredAt: timestamp("scored_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("deal_scores_listing_idx").on(table.listingId),
    index("deal_scores_score_idx").on(table.dealScore),
  ]
);

export const marketCompsSummary = pgTable("market_comps_summary", {
  id: serial("id").primaryKey(),
  city: text("city").notNull(),
  vehicleSegment: text("vehicle_segment").notNull(),
  make: text("make"),
  model: text("model"),
  medianPrice: real("median_price"),
  inventoryCount: integer("inventory_count"),
  avgDaysOnMarket: real("avg_days_on_market"),
  priceChange30d: real("price_change_30d"),
  demandVelocity: text("demand_velocity"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobsRuns = pgTable("jobs_runs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  recordsProcessed: integer("records_processed").default(0),
  errors: jsonb("errors").$type<string[]>().default([]),
});

export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});

export const insertDealScoreSchema = createInsertSchema(dealScores).omit({
  id: true,
  scoredAt: true,
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type ListingSnapshot = typeof listingSnapshots.$inferSelect;
export type ListingDuplicate = typeof listingDuplicates.$inferSelect;
export type DealScore = typeof dealScores.$inferSelect;
export type MarketCompsSummary = typeof marketCompsSummary.$inferSelect;
export type JobRun = typeof jobsRuns.$inferSelect;
