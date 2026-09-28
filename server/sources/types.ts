export const LICENSED_MARKET_SOURCE = "licensed-market";
export const MIN_LISTING_PRICE = 10_000;
export const MAX_LISTING_PRICE = 35_000;
export const MAX_LISTING_MILEAGE = 90_000;
export const MIN_MODEL_YEAR = 2020;
export const SEARCH_POSTAL_CODE = "78250";
export const SEARCH_RADIUS_MILES = 45;
export const MAX_ROWS_PER_TARGET = 100;

// San Antonio's ten most popular vehicles (used-market share, 2025 research).
export const TARGET_VEHICLES = [
  { make: "Ford", model: "F-150" },
  { make: "Chevrolet", model: "Silverado 1500" },
  { make: "Toyota", model: "Camry" },
  { make: "Ram", model: "1500" },
  { make: "Toyota", model: "Tacoma" },
  { make: "GMC", model: "Sierra 1500" },
  { make: "Toyota", model: "Tundra" },
  { make: "Toyota", model: "RAV4" },
  { make: "Honda", model: "CR-V" },
  { make: "Toyota", model: "Corolla" },
] as const;

// MarketCheck names Ram's half-ton "Ram 1500 Pickup" / "Ram 1500 Classic" and
// returns nothing for model "1500". Query with its names, then store results
// under the app's canonical model so eligibility and scoring keys still match.
const MARKETCHECK_MODEL_QUERIES: Record<string, string> = {
  "ram|1500": "Ram 1500 Pickup,Ram 1500 Classic",
};

export function marketCheckModelQuery(make: string, model: string): string {
  return MARKETCHECK_MODEL_QUERIES[`${make}|${model}`.toLowerCase()] ?? model;
}

export function canonicalModel(make: string, model: string): string {
  if (make.trim().toLowerCase() === "ram" && /^(ram\s+)?1500(\s+(pickup|classic))?$/i.test(model.trim())) {
    return "1500";
  }
  return model;
}

export type VehicleTarget = {
  make: string;
  model: string;
  yearMin?: number | null;
  priceMax?: number | null;
  mileageMax?: number | null;
};

export type InventoryProvider = "marketcheck" | "autodev";

export interface RawVehicleListing {
  provider: InventoryProvider;
  external_id: string;
  vin: string | null;
  year: string | number | undefined;
  make: string | undefined;
  model: string | undefined;
  trim: string | null;
  body_type: string | null;
  price: string | number | null;
  mileage: string | number | null;
  city: string;
  state: string;
  postal_code: string | null;
  lat: number | string | null;
  lon: number | string | null;
  dealer_name: string;
  is_dealer: boolean;
  listing_url: string | null;
  title_status: "clean" | "unknown";
  image_urls: string[];
  raw_payload: unknown;
}

export interface ProviderFetchResult {
  provider: InventoryProvider;
  listings: RawVehicleListing[];
  sourceCount: number;
  excludedOverPrice: number;
  excludedInvalid: number;
}

export interface ProviderSecrets {
  MARKETCHECK_API_KEY: string;
  AUTODEV_API_KEY: string;
}

export function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function recordOrEmpty(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.startsWith("http"),
      )
    : [];
}

export function isEligibleListing(
  listing: RawVehicleListing,
  targets: readonly VehicleTarget[] = TARGET_VEHICLES,
): boolean {
  const year = numberOrNull(listing.year);
  const price = numberOrNull(listing.price);
  const mileage = numberOrNull(listing.mileage);
  const make = listing.make?.trim().toLowerCase();
  const model =
    listing.make && listing.model
      ? canonicalModel(listing.make, listing.model).trim().toLowerCase()
      : undefined;
  const targetMatch = targets.some(
    (target) =>
      target.make.toLowerCase() === make && target.model.toLowerCase() === model,
  );
  const target = targets.find(
    (item) => item.make.toLowerCase() === make && item.model.toLowerCase() === model,
  );

  return Boolean(
    targetMatch &&
      year !== null &&
      year >= (target?.yearMin ?? MIN_MODEL_YEAR) &&
      price !== null &&
      price >= MIN_LISTING_PRICE &&
      price <= (target?.priceMax ?? MAX_LISTING_PRICE) &&
      mileage !== null &&
      mileage >= 0 &&
      mileage <= (target?.mileageMax ?? MAX_LISTING_MILEAGE),
  );
}
