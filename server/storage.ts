import type {
  DealScore,
  InsertListing,
  JobRun,
  Listing,
  ListingSnapshot,
  MarketCompsSummary,
  ScoreBreakdown,
} from "@shared/schema";
import type { VehicleTarget, VehicleTargetFilter } from "@shared/schema";

type DbValue = string | number | boolean | null;
type DbRow = Record<string, unknown>;

export interface ScoreWrite {
  listingId: number;
  dealScore: number;
  marketValueEst: number | null;
  compCount: number | null;
  compPriceMedian: number | null;
  confidence: number | null;
  savingsAmount: number | null;
  scoreBreakdown: ScoreBreakdown;
  scoreReasons: string[];
  velocityPrediction: number | null;
  wholesaleEstimate: number | null;
  suggestedOffer: number | null;
}

export interface MarketCompWrite {
  city: string;
  vehicleSegment: string;
  make?: string | null;
  model?: string | null;
  medianPrice?: number | null;
  inventoryCount?: number | null;
  avgDaysOnMarket?: number | null;
  priceChange30d?: number | null;
  demandVelocity?: string | null;
}

export type ListingWrite = InsertListing & { id?: number };

export interface IStorage {
  insertListing(data: InsertListing): Promise<Listing>;
  updateListing(id: number, data: InsertListing): Promise<Listing>;
  upsertListings(data: ListingWrite[], seenAt: Date): Promise<void>;
  getListingById(id: number): Promise<Listing | undefined>;
  getAllListings(): Promise<Listing[]>;
  getActiveListings(): Promise<Listing[]>;
  getListingsByMakeModel(make: string, model: string): Promise<Listing[]>;
  getListingsByCity(city: string): Promise<Listing[]>;
  getListingsCount(): Promise<number>;
  deactivateListingsNotSeenSince(source: string, startedAt: Date): Promise<number>;
  insertSnapshot(listingId: number, price: number | null, mileage: number | null): Promise<void>;
  getSnapshotsForListing(listingId: number): Promise<ListingSnapshot[]>;
  getSnapshotsForListings(listingIds: number[]): Promise<ListingSnapshot[]>;
  getPriceDropCount24h(): Promise<number>;
  upsertDealScore(data: ScoreWrite): Promise<void>;
  upsertDealScores(data: ScoreWrite[]): Promise<void>;
  getTopDeals(minScore: number, limit: number): Promise<(Listing & { score: DealScore })[]>;
  getDealScoreForListing(listingId: number): Promise<DealScore | undefined>;
  upsertMarketComps(data: MarketCompWrite): Promise<void>;
  upsertMarketCompsBatch(data: MarketCompWrite[]): Promise<void>;
  getMarketComps(city: string): Promise<MarketCompsSummary[]>;
  getMarketCompsByMakeModel(city: string, make: string, model: string): Promise<MarketCompsSummary | undefined>;
  insertJobRun(jobType: string): Promise<JobRun>;
  completeJobRun(id: number, recordsProcessed: number, errors: string[]): Promise<void>;
  getLatestJobRun(jobType: string): Promise<JobRun | undefined>;
  getActiveVehicleTargets(): Promise<VehicleTarget[]>;
  addVehicleTarget(data: VehicleTargetFilter): Promise<VehicleTarget>;
  deactivateVehicleTarget(id: number): Promise<void>;
}

const LISTING_COLUMNS = `
  source, external_id, vin, year, make, model, trim, body_type, price, mileage,
  city, state, postal_code, lat, lon, dealer_name, is_dealer, is_active,
  listing_url, title_status, image_urls, raw_payload
`;

const BULK_CHUNK_SIZE = 50;

function chunksOf<T>(values: T[], size = BULK_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function epochSeconds(date = new Date()): number {
  return Math.floor(date.getTime() / 1_000);
}

function dateFromDb(value: unknown): Date {
  return new Date(Number(value ?? 0) * 1_000);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function boolFromDb(value: unknown): boolean {
  return Number(value) === 1;
}

function listingFromRow(row: DbRow): Listing {
  return {
    id: Number(row.id),
    source: String(row.source),
    externalId: row.external_id == null ? null : String(row.external_id),
    vin: row.vin == null ? null : String(row.vin),
    year: Number(row.year),
    make: String(row.make),
    model: String(row.model),
    trim: row.trim == null ? null : String(row.trim),
    bodyType: row.body_type == null ? null : String(row.body_type),
    price: row.price == null ? null : Number(row.price),
    mileage: row.mileage == null ? null : Number(row.mileage),
    city: row.city == null ? null : String(row.city),
    state: row.state == null ? null : String(row.state),
    postalCode: row.postal_code == null ? null : String(row.postal_code),
    lat: row.lat == null ? null : Number(row.lat),
    lon: row.lon == null ? null : Number(row.lon),
    dealerName: row.dealer_name == null ? null : String(row.dealer_name),
    isDealer: row.is_dealer == null ? null : boolFromDb(row.is_dealer),
    isActive: boolFromDb(row.is_active),
    listingUrl: row.listing_url == null ? null : String(row.listing_url),
    firstSeenAt: dateFromDb(row.first_seen_at),
    lastSeenAt: dateFromDb(row.last_seen_at),
    titleStatus: row.title_status == null ? null : String(row.title_status),
    imageUrls: parseJson<string[]>(row.image_urls, []),
    rawPayload: parseJson<unknown>(row.raw_payload, null),
  };
}

function scoreFromRow(row: DbRow, prefix = ""): DealScore {
  const value = (name: string) => row[`${prefix}${name}`];
  return {
    id: Number(value("id")),
    listingId: Number(value("listing_id")),
    dealScore: Number(value("deal_score")),
    marketValueEst: value("market_value_est") == null ? null : Number(value("market_value_est")),
    compCount: value("comp_count") == null ? null : Number(value("comp_count")),
    compPriceMedian: value("comp_price_median") == null ? null : Number(value("comp_price_median")),
    confidence: value("confidence") == null ? null : Number(value("confidence")),
    savingsAmount: value("savings_amount") == null ? null : Number(value("savings_amount")),
    scoreBreakdown: parseJson<ScoreBreakdown | null>(value("score_breakdown"), null),
    scoreReasons: parseJson<string[]>(value("score_reasons"), []),
    velocityPrediction: value("velocity_prediction") == null ? null : Number(value("velocity_prediction")),
    wholesaleEstimate: value("wholesale_estimate") == null ? null : Number(value("wholesale_estimate")),
    suggestedOffer: value("suggested_offer") == null ? null : Number(value("suggested_offer")),
    scoredAt: dateFromDb(value("scored_at")),
  };
}

function marketCompFromRow(row: DbRow): MarketCompsSummary {
  return {
    id: Number(row.id),
    city: String(row.city),
    vehicleSegment: String(row.vehicle_segment),
    make: row.make == null ? null : String(row.make),
    model: row.model == null ? null : String(row.model),
    medianPrice: row.median_price == null ? null : Number(row.median_price),
    inventoryCount: row.inventory_count == null ? null : Number(row.inventory_count),
    avgDaysOnMarket: row.avg_days_on_market == null ? null : Number(row.avg_days_on_market),
    priceChange30d: row.price_change_30d == null ? null : Number(row.price_change_30d),
    demandVelocity: row.demand_velocity == null ? null : String(row.demand_velocity),
    createdAt: dateFromDb(row.created_at),
  };
}

function jobFromRow(row: DbRow): JobRun {
  return {
    id: Number(row.id),
    jobType: String(row.job_type),
    status: String(row.status),
    startedAt: dateFromDb(row.started_at),
    completedAt: row.completed_at == null ? null : dateFromDb(row.completed_at),
    recordsProcessed: row.records_processed == null ? null : Number(row.records_processed),
    errors: parseJson<string[]>(row.errors, []),
  };
}

function vehicleTargetFromRow(row: DbRow): VehicleTarget {
  return {
    id: Number(row.id),
    make: String(row.make),
    model: String(row.model),
    yearMin: row.year_min != null ? Number(row.year_min) : null,
    priceMax: row.price_max != null ? Number(row.price_max) : null,
    mileageMax: row.mileage_max != null ? Number(row.mileage_max) : null,
    isActive: boolFromDb(row.is_active),
    createdAt: dateFromDb(row.created_at),
  };
}

function listingBindings(data: InsertListing): DbValue[] {
  return [
    data.source,
    data.externalId,
    data.vin,
    data.year,
    data.make,
    data.model,
    data.trim,
    data.bodyType,
    data.price,
    data.mileage,
    data.city,
    data.state,
    data.postalCode,
    data.lat,
    data.lon,
    data.dealerName,
    data.isDealer ? 1 : 0,
    data.isActive === false ? 0 : 1,
    data.listingUrl,
    data.titleStatus,
    JSON.stringify(data.imageUrls ?? []),
    JSON.stringify(data.rawPayload ?? null),
  ];
}

export class DatabaseStorage implements IStorage {
  constructor(private readonly db: D1Database) {}

  private async all(sql: string, ...bindings: DbValue[]): Promise<DbRow[]> {
    const result = await this.db.prepare(sql).bind(...bindings).all<DbRow>();
    return result.results ?? [];
  }

  async insertListing(data: InsertListing): Promise<Listing> {
    const placeholders = new Array(22).fill("?").join(", ");
    const result = await this.db
      .prepare(`INSERT INTO listings (${LISTING_COLUMNS}) VALUES (${placeholders})`)
      .bind(...listingBindings(data))
      .run();
    const row = await this.getListingById(Number(result.meta.last_row_id));
    if (!row) throw new Error("Inserted listing could not be read back");
    return row;
  }

  async updateListing(id: number, data: InsertListing): Promise<Listing> {
    const assignments = LISTING_COLUMNS.split(",")
      .map((column) => column.trim())
      .filter(Boolean)
      .map((column) => `${column} = ?`)
      .join(", ");
    await this.db
      .prepare(`UPDATE listings SET ${assignments}, is_active = 1, last_seen_at = ? WHERE id = ?`)
      .bind(...listingBindings(data), epochSeconds(), id)
      .run();
    const row = await this.getListingById(id);
    if (!row) throw new Error(`Listing ${id} could not be read after update`);
    return row;
  }

  async upsertListings(data: ListingWrite[], seenAt: Date): Promise<void> {
    const seenAtEpoch = epochSeconds(seenAt);

    for (const chunk of chunksOf(data)) {
      const payload = chunk.map((listing) => ({
        id: listing.id ?? null,
        source: listing.source,
        external_id: listing.externalId,
        vin: listing.vin,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        trim: listing.trim,
        body_type: listing.bodyType,
        price: listing.price,
        mileage: listing.mileage,
        city: listing.city,
        state: listing.state,
        postal_code: listing.postalCode,
        lat: listing.lat,
        lon: listing.lon,
        dealer_name: listing.dealerName,
        is_dealer: listing.isDealer ? 1 : 0,
        is_active: listing.isActive === false ? 0 : 1,
        listing_url: listing.listingUrl,
        title_status: listing.titleStatus,
        image_urls: JSON.stringify(listing.imageUrls ?? []),
        raw_payload: JSON.stringify(listing.rawPayload ?? null),
      }));

      await this.db
        .prepare(`
          INSERT INTO listings (
            id, source, external_id, vin, year, make, model, trim, body_type,
            price, mileage, city, state, postal_code, lat, lon, dealer_name,
            is_dealer, is_active, listing_url, first_seen_at, last_seen_at,
            title_status, image_urls, raw_payload
          )
          SELECT
            json_extract(value, '$.id'),
            json_extract(value, '$.source'),
            json_extract(value, '$.external_id'),
            json_extract(value, '$.vin'),
            json_extract(value, '$.year'),
            json_extract(value, '$.make'),
            json_extract(value, '$.model'),
            json_extract(value, '$.trim'),
            json_extract(value, '$.body_type'),
            json_extract(value, '$.price'),
            json_extract(value, '$.mileage'),
            json_extract(value, '$.city'),
            json_extract(value, '$.state'),
            json_extract(value, '$.postal_code'),
            json_extract(value, '$.lat'),
            json_extract(value, '$.lon'),
            json_extract(value, '$.dealer_name'),
            json_extract(value, '$.is_dealer'),
            json_extract(value, '$.is_active'),
            json_extract(value, '$.listing_url'),
            ?2,
            ?2,
            json_extract(value, '$.title_status'),
            json_extract(value, '$.image_urls'),
            json_extract(value, '$.raw_payload')
          FROM json_each(?1)
          WHERE true
          ON CONFLICT DO UPDATE SET
            source = excluded.source,
            external_id = excluded.external_id,
            vin = excluded.vin,
            year = excluded.year,
            make = excluded.make,
            model = excluded.model,
            trim = excluded.trim,
            body_type = excluded.body_type,
            price = excluded.price,
            mileage = excluded.mileage,
            city = excluded.city,
            state = excluded.state,
            postal_code = excluded.postal_code,
            lat = excluded.lat,
            lon = excluded.lon,
            dealer_name = excluded.dealer_name,
            is_dealer = excluded.is_dealer,
            is_active = 1,
            listing_url = excluded.listing_url,
            last_seen_at = excluded.last_seen_at,
            title_status = excluded.title_status,
            image_urls = excluded.image_urls,
            raw_payload = excluded.raw_payload
        `)
        .bind(JSON.stringify(payload), seenAtEpoch)
        .run();
    }
  }

  async getListingById(id: number): Promise<Listing | undefined> {
    const row = await this.db.prepare("SELECT * FROM listings WHERE id = ? LIMIT 1").bind(id).first<DbRow>();
    return row ? listingFromRow(row) : undefined;
  }

  async getAllListings(): Promise<Listing[]> {
    return (await this.all("SELECT * FROM listings")).map(listingFromRow);
  }

  async getActiveListings(): Promise<Listing[]> {
    return (await this.all("SELECT * FROM listings WHERE is_active = 1")).map(listingFromRow);
  }

  async getListingsByMakeModel(make: string, model: string): Promise<Listing[]> {
    return (
      await this.all(
        "SELECT * FROM listings WHERE is_active = 1 AND make LIKE ? COLLATE NOCASE AND model LIKE ? COLLATE NOCASE",
        make,
        model,
      )
    ).map(listingFromRow);
  }

  async getListingsByCity(city: string): Promise<Listing[]> {
    return (
      await this.all(
        "SELECT * FROM listings WHERE is_active = 1 AND city LIKE ? COLLATE NOCASE",
        city,
      )
    ).map(listingFromRow);
  }

  async getListingsCount(): Promise<number> {
    const row = await this.db.prepare("SELECT count(*) AS count FROM listings WHERE is_active = 1").first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async deactivateListingsNotSeenSince(source: string, startedAt: Date): Promise<number> {
    const result = await this.db
      .prepare("UPDATE listings SET is_active = 0 WHERE source = ? AND is_active = 1 AND last_seen_at < ?")
      .bind(source, epochSeconds(startedAt))
      .run();
    return Number(result.meta.changes ?? 0);
  }

  async insertSnapshot(listingId: number, price: number | null, mileage: number | null): Promise<void> {
    await this.db
      .prepare("INSERT INTO listing_snapshots (listing_id, price, mileage) VALUES (?, ?, ?)")
      .bind(listingId, price, mileage)
      .run();
  }

  async getSnapshotsForListing(listingId: number): Promise<ListingSnapshot[]> {
    const rows = await this.all(
      "SELECT * FROM listing_snapshots WHERE listing_id = ? ORDER BY snapshot_at",
      listingId,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      listingId: Number(row.listing_id),
      price: row.price == null ? null : Number(row.price),
      mileage: row.mileage == null ? null : Number(row.mileage),
      snapshotAt: dateFromDb(row.snapshot_at),
    }));
  }

  async getSnapshotsForListings(listingIds: number[]): Promise<ListingSnapshot[]> {
    if (listingIds.length === 0) return [];
    const rows = await this.all(
      `SELECT * FROM listing_snapshots
       WHERE listing_id IN (
         SELECT CAST(value AS INTEGER) FROM json_each(?)
       )
       ORDER BY listing_id, snapshot_at`,
      JSON.stringify(listingIds),
    );
    return rows.map((row) => ({
      id: Number(row.id),
      listingId: Number(row.listing_id),
      price: row.price == null ? null : Number(row.price),
      mileage: row.mileage == null ? null : Number(row.mileage),
      snapshotAt: dateFromDb(row.snapshot_at),
    }));
  }

  async getPriceDropCount24h(): Promise<number> {
    const cutoff = epochSeconds(new Date(Date.now() - 24 * 60 * 60 * 1_000));
    const row = await this.db
      .prepare("SELECT count(DISTINCT listing_id) AS count FROM listing_snapshots WHERE snapshot_at >= ?")
      .bind(cutoff)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async upsertDealScore(data: ScoreWrite): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO deal_scores (
          listing_id, deal_score, market_value_est, comp_count, comp_price_median,
          confidence, savings_amount, score_breakdown, score_reasons,
          velocity_prediction, wholesale_estimate, suggested_offer, scored_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(listing_id) DO UPDATE SET
          deal_score = excluded.deal_score,
          market_value_est = excluded.market_value_est,
          comp_count = excluded.comp_count,
          comp_price_median = excluded.comp_price_median,
          confidence = excluded.confidence,
          savings_amount = excluded.savings_amount,
          score_breakdown = excluded.score_breakdown,
          score_reasons = excluded.score_reasons,
          velocity_prediction = excluded.velocity_prediction,
          wholesale_estimate = excluded.wholesale_estimate,
          suggested_offer = excluded.suggested_offer,
          scored_at = excluded.scored_at
      `)
      .bind(
        data.listingId,
        data.dealScore,
        data.marketValueEst,
        data.compCount,
        data.compPriceMedian,
        data.confidence,
        data.savingsAmount,
        JSON.stringify(data.scoreBreakdown),
        JSON.stringify(data.scoreReasons),
        data.velocityPrediction,
        data.wholesaleEstimate,
        data.suggestedOffer,
        epochSeconds(),
      )
      .run();
  }

  async upsertDealScores(data: ScoreWrite[]): Promise<void> {
    const scoredAt = epochSeconds();
    for (const chunk of chunksOf(data, 200)) {
      const payload = chunk.map((score) => ({
        listing_id: score.listingId,
        deal_score: score.dealScore,
        market_value_est: score.marketValueEst,
        comp_count: score.compCount,
        comp_price_median: score.compPriceMedian,
        confidence: score.confidence,
        savings_amount: score.savingsAmount,
        score_breakdown: JSON.stringify(score.scoreBreakdown),
        score_reasons: JSON.stringify(score.scoreReasons),
        velocity_prediction: score.velocityPrediction,
        wholesale_estimate: score.wholesaleEstimate,
        suggested_offer: score.suggestedOffer,
      }));

      await this.db
        .prepare(`
          INSERT INTO deal_scores (
            listing_id, deal_score, market_value_est, comp_count,
            comp_price_median, confidence, savings_amount, score_breakdown,
            score_reasons, velocity_prediction, wholesale_estimate,
            suggested_offer, scored_at
          )
          SELECT
            json_extract(value, '$.listing_id'),
            json_extract(value, '$.deal_score'),
            json_extract(value, '$.market_value_est'),
            json_extract(value, '$.comp_count'),
            json_extract(value, '$.comp_price_median'),
            json_extract(value, '$.confidence'),
            json_extract(value, '$.savings_amount'),
            json_extract(value, '$.score_breakdown'),
            json_extract(value, '$.score_reasons'),
            json_extract(value, '$.velocity_prediction'),
            json_extract(value, '$.wholesale_estimate'),
            json_extract(value, '$.suggested_offer'),
            ?2
          FROM json_each(?1)
          WHERE true
          ON CONFLICT(listing_id) DO UPDATE SET
            deal_score = excluded.deal_score,
            market_value_est = excluded.market_value_est,
            comp_count = excluded.comp_count,
            comp_price_median = excluded.comp_price_median,
            confidence = excluded.confidence,
            savings_amount = excluded.savings_amount,
            score_breakdown = excluded.score_breakdown,
            score_reasons = excluded.score_reasons,
            velocity_prediction = excluded.velocity_prediction,
            wholesale_estimate = excluded.wholesale_estimate,
            suggested_offer = excluded.suggested_offer,
            scored_at = excluded.scored_at
        `)
        .bind(JSON.stringify(payload), scoredAt)
        .run();
    }
  }

  async getTopDeals(minScore: number, limit: number): Promise<(Listing & { score: DealScore })[]> {
    const rows = await this.all(
      `SELECT l.*,
        s.id AS score_id, s.listing_id AS score_listing_id,
        s.deal_score AS score_deal_score,
        s.market_value_est AS score_market_value_est,
        s.comp_count AS score_comp_count,
        s.comp_price_median AS score_comp_price_median,
        s.confidence AS score_confidence,
        s.savings_amount AS score_savings_amount,
        s.score_breakdown AS score_score_breakdown,
        s.score_reasons AS score_score_reasons,
        s.velocity_prediction AS score_velocity_prediction,
        s.wholesale_estimate AS score_wholesale_estimate,
        s.suggested_offer AS score_suggested_offer,
        s.scored_at AS score_scored_at
      FROM deal_scores s
      INNER JOIN listings l ON l.id = s.listing_id
      WHERE l.is_active = 1 AND s.deal_score >= ?
      ORDER BY s.deal_score DESC
      LIMIT ?`,
      minScore,
      limit,
    );
    return rows.map((row) => ({ ...listingFromRow(row), score: scoreFromRow(row, "score_") }));
  }

  async getDealScoreForListing(listingId: number): Promise<DealScore | undefined> {
    const row = await this.db.prepare("SELECT * FROM deal_scores WHERE listing_id = ? LIMIT 1").bind(listingId).first<DbRow>();
    return row ? scoreFromRow(row) : undefined;
  }

  async upsertMarketComps(data: MarketCompWrite): Promise<void> {
    const existing = await this.db
      .prepare(`
        SELECT id FROM market_comps_summary
        WHERE lower(city) = lower(?) AND lower(vehicle_segment) = lower(?)
          AND ((? IS NULL AND make IS NULL) OR lower(make) = lower(?))
          AND ((? IS NULL AND model IS NULL) OR lower(model) = lower(?))
        LIMIT 1
      `)
      .bind(
        data.city,
        data.vehicleSegment,
        data.make ?? null,
        data.make ?? null,
        data.model ?? null,
        data.model ?? null,
      )
      .first<{ id: number }>();

    const values: DbValue[] = [
      data.medianPrice ?? null,
      data.inventoryCount ?? null,
      data.avgDaysOnMarket ?? null,
      data.priceChange30d ?? null,
      data.demandVelocity ?? null,
      epochSeconds(),
    ];
    if (existing) {
      await this.db
        .prepare(`UPDATE market_comps_summary SET median_price = ?, inventory_count = ?, avg_days_on_market = ?, price_change_30d = ?, demand_velocity = ?, created_at = ? WHERE id = ?`)
        .bind(...values, existing.id)
        .run();
      return;
    }

    await this.db
      .prepare(`INSERT INTO market_comps_summary (city, vehicle_segment, make, model, median_price, inventory_count, avg_days_on_market, price_change_30d, demand_velocity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        data.city,
        data.vehicleSegment,
        data.make ?? null,
        data.model ?? null,
        ...values,
      )
      .run();
  }

  async upsertMarketCompsBatch(data: MarketCompWrite[]): Promise<void> {
    if (data.length === 0) return;
    const createdAt = epochSeconds();
    const payload = data.map((comp) => ({
      city: comp.city,
      vehicle_segment: comp.vehicleSegment,
      make: comp.make ?? null,
      model: comp.model ?? null,
      median_price: comp.medianPrice ?? null,
      inventory_count: comp.inventoryCount ?? null,
      avg_days_on_market: comp.avgDaysOnMarket ?? null,
      price_change_30d: comp.priceChange30d ?? null,
      demand_velocity: comp.demandVelocity ?? null,
    }));

    await this.db
      .prepare(`
        INSERT INTO market_comps_summary (
          city, vehicle_segment, make, model, median_price, inventory_count,
          avg_days_on_market, price_change_30d, demand_velocity, created_at
        )
        SELECT
          json_extract(value, '$.city'),
          json_extract(value, '$.vehicle_segment'),
          json_extract(value, '$.make'),
          json_extract(value, '$.model'),
          json_extract(value, '$.median_price'),
          json_extract(value, '$.inventory_count'),
          json_extract(value, '$.avg_days_on_market'),
          json_extract(value, '$.price_change_30d'),
          json_extract(value, '$.demand_velocity'),
          ?2
        FROM json_each(?1)
        WHERE true
        ON CONFLICT DO UPDATE SET
          median_price = excluded.median_price,
          inventory_count = excluded.inventory_count,
          avg_days_on_market = excluded.avg_days_on_market,
          price_change_30d = excluded.price_change_30d,
          demand_velocity = excluded.demand_velocity,
          created_at = excluded.created_at
      `)
      .bind(JSON.stringify(payload), createdAt)
      .run();
  }

  async getMarketComps(city: string): Promise<MarketCompsSummary[]> {
    return (
      await this.all(
        "SELECT * FROM market_comps_summary WHERE city LIKE ? COLLATE NOCASE",
        city,
      )
    ).map(marketCompFromRow);
  }

  async getMarketCompsByMakeModel(city: string, make: string, model: string): Promise<MarketCompsSummary | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM market_comps_summary WHERE city LIKE ? COLLATE NOCASE AND make LIKE ? COLLATE NOCASE AND model LIKE ? COLLATE NOCASE LIMIT 1")
      .bind(city, make, model)
      .first<DbRow>();
    return row ? marketCompFromRow(row) : undefined;
  }

  async insertJobRun(jobType: string): Promise<JobRun> {
    const row = await this.db
      .prepare("INSERT INTO jobs_runs (job_type, status) VALUES (?, 'running') RETURNING *")
      .bind(jobType)
      .first<DbRow>();
    if (!row) throw new Error("Job run could not be read after insert");
    return jobFromRow(row);
  }

  async completeJobRun(id: number, recordsProcessed: number, errors: string[]): Promise<void> {
    await this.db
      .prepare("UPDATE jobs_runs SET status = ?, completed_at = ?, records_processed = ?, errors = ? WHERE id = ?")
      .bind(
        errors.length > 0 ? "completed_with_errors" : "completed",
        epochSeconds(),
        recordsProcessed,
        JSON.stringify(errors),
        id,
      )
      .run();
  }

  async getLatestJobRun(jobType: string): Promise<JobRun | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM jobs_runs WHERE job_type = ? ORDER BY started_at DESC, id DESC LIMIT 1")
      .bind(jobType)
      .first<DbRow>();
    return row ? jobFromRow(row) : undefined;
  }

  async getActiveVehicleTargets(): Promise<VehicleTarget[]> {
    return (
      await this.all(
        "SELECT * FROM vehicle_targets WHERE is_active = 1 ORDER BY make, model",
      )
    ).map(vehicleTargetFromRow);
  }

  async addVehicleTarget(data: VehicleTargetFilter): Promise<VehicleTarget> {
    const row = await this.db
      .prepare(
        "INSERT INTO vehicle_targets (make, model, year_min, price_max, mileage_max) VALUES (?, ?, ?, ?, ?) RETURNING *",
      )
      .bind(
        data.make,
        data.model,
        data.yearMin ?? null,
        data.priceMax ?? null,
        data.mileageMax ?? null,
      )
      .first<DbRow>();
    if (!row) throw new Error("Vehicle target could not be read after insert");
    return vehicleTargetFromRow(row);
  }

  async deactivateVehicleTarget(id: number): Promise<void> {
    await this.db
      .prepare("UPDATE vehicle_targets SET is_active = 0 WHERE id = ?")
      .bind(id)
      .run();
  }
}
