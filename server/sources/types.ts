export const LICENSED_MARKET_SOURCE = "licensed-market";
export const MIN_LISTING_PRICE = 10_000;
export const MAX_LISTING_PRICE = 35_000;
export const MAX_LISTING_MILEAGE = 90_000;
export const MIN_MODEL_YEAR = 2020;
export const SEARCH_POSTAL_CODE = "78205";
export const SEARCH_RADIUS_MILES = 100;
export const MAX_ROWS_PER_TARGET = 100;

export const TARGET_VEHICLES = [
  { make: "Ford", model: "F-150" },
  { make: "Chevrolet", model: "Silverado 1500" },
] as const;

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

export function isEligibleListing(listing: RawVehicleListing): boolean {
  const year = numberOrNull(listing.year);
  const price = numberOrNull(listing.price);
  const mileage = numberOrNull(listing.mileage);
  const make = listing.make?.trim().toLowerCase();
  const model = listing.model?.trim().toLowerCase();
  const targetMatch = TARGET_VEHICLES.some(
    (target) =>
      target.make.toLowerCase() === make && target.model.toLowerCase() === model,
  );

  return Boolean(
    targetMatch &&
      year !== null &&
      year >= MIN_MODEL_YEAR &&
      price !== null &&
      price >= MIN_LISTING_PRICE &&
      price <= MAX_LISTING_PRICE &&
      mileage !== null &&
      mileage >= 0 &&
      mileage <= MAX_LISTING_MILEAGE,
  );
}
