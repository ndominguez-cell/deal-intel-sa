export interface Listing {
  id: number;
  source: string;
  externalId: string | null;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  bodyType: string | null;
  price: number | null;
  mileage: number | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  lat: number | null;
  lon: number | null;
  dealerName: string | null;
  isDealer: boolean | null;
  isActive: boolean;
  listingUrl: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  titleStatus: string | null;
  imageUrls: string[] | null;
  rawPayload: unknown;
}

export type InsertListing = Omit<
  Listing,
  "id" | "firstSeenAt" | "lastSeenAt" | "isActive"
> & { isActive?: boolean };

export interface ListingSnapshot {
  id: number;
  listingId: number;
  price: number | null;
  mileage: number | null;
  snapshotAt: Date;
}

export interface ListingDuplicate {
  id: number;
  canonicalListingId: number;
  duplicateListingId: number;
  matchType: string;
  detectedAt: Date;
}

export interface ScoreBreakdown {
  priceAdvantage: number;
  mileageAdvantage: number;
  localDemand: number;
  reliability: number;
  sellerQuality: number;
  priceDropSignal: number;
}

export interface DealScore {
  id: number;
  listingId: number;
  dealScore: number;
  marketValueEst: number | null;
  compCount: number | null;
  compPriceMedian: number | null;
  confidence: number | null;
  savingsAmount: number | null;
  scoreBreakdown: ScoreBreakdown | null;
  scoreReasons: string[] | null;
  velocityPrediction: number | null;
  wholesaleEstimate: number | null;
  suggestedOffer: number | null;
  scoredAt: Date;
}

export interface MarketCompsSummary {
  id: number;
  city: string;
  vehicleSegment: string;
  make: string | null;
  model: string | null;
  medianPrice: number | null;
  inventoryCount: number | null;
  avgDaysOnMarket: number | null;
  priceChange30d: number | null;
  demandVelocity: string | null;
  createdAt: Date;
}

export interface JobRun {
  id: number;
  jobType: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  recordsProcessed: number | null;
  errors: string[] | null;
}
