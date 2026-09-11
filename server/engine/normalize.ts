import type { InsertListing } from "@shared/schema";
import type { RawVehicleListing } from "../sources/types";
import { SA_AREA_CITIES } from "./constants";

const MAKE_CORRECTIONS: Record<string, string> = {
  chevy: "Chevrolet",
  chev: "Chevrolet",
  merc: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  vw: "Volkswagen",
};

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function normalizeMake(make: string): string {
  const lower = make.toLowerCase().trim();
  if (MAKE_CORRECTIONS[lower]) return MAKE_CORRECTIONS[lower];
  if (lower === "bmw") return "BMW";
  if (lower === "gmc") return "GMC";
  if (lower === "ram") return "Ram";
  return titleCase(lower);
}

export function normalizeModel(model: string): string {
  const trimmed = model.trim();
  const upper = trimmed.toUpperCase();
  if (["F-150", "F150"].includes(upper)) return "F-150";
  if (["RAV4"].includes(upper)) return "RAV4";
  if (["CR-V", "CRV"].includes(upper)) return "CR-V";
  if (["4RUNNER"].includes(upper)) return "4Runner";
  if (["CX-5", "CX5"].includes(upper)) return "CX-5";
  return titleCase(trimmed);
}

export function sanitizePrice(price: unknown): number | null {
  if (price == null) return null;
  const n = typeof price === "string" ? parseFloat(price.replace(/[^0-9.]/g, "")) : Number(price);
  if (isNaN(n) || n <= 0 || n > 500000) return null;
  return Math.round(n * 100) / 100;
}

export function sanitizeMileage(mileage: unknown): number | null {
  if (mileage == null) return null;
  const n = typeof mileage === "string" ? parseInt(mileage.replace(/[^0-9]/g, ""), 10) : Number(mileage);
  if (isNaN(n) || n < 0 || n > 500000) return null;
  return n;
}

export function geocodeCity(city: string | null, state: string | null): { lat: number; lon: number } | null {
  if (!city) return null;
  const key = city.toLowerCase().trim();
  if (SA_AREA_CITIES[key]) return SA_AREA_CITIES[key];
  return null;
}

export function normalizeListing(raw: RawVehicleListing, source: string): InsertListing {
  const rawMake = raw.make ?? "";
  const rawModel = raw.model ?? "";
  const year = Number.parseInt(String(raw.year ?? ""), 10);
  if (!rawMake || !rawModel || !Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("year, make, and model are required");
  }

  const make = normalizeMake(rawMake);
  const model = normalizeModel(rawModel);
  const city = raw.city || null;
  const state = raw.state || "TX";

  let lat = raw.lat != null ? Number(raw.lat) : null;
  let lon = raw.lon != null ? Number(raw.lon) : null;

  if ((lat == null || lon == null) && city) {
    const geo = geocodeCity(city, state);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }

  return {
    source,
    externalId: raw.external_id || null,
    vin: raw.vin || null,
    year,
    make,
    model,
    trim: raw.trim || null,
    bodyType: raw.body_type || null,
    price: sanitizePrice(raw.price),
    mileage: sanitizeMileage(raw.mileage),
    city: city ? titleCase(city) : null,
    state: state ? state.toUpperCase() : null,
    postalCode: raw.postal_code || null,
    lat,
    lon,
    dealerName: raw.dealer_name || null,
    isDealer: raw.is_dealer,
    listingUrl: raw.listing_url || null,
    titleStatus: raw.title_status.toLowerCase(),
    imageUrls: raw.image_urls,
    rawPayload: raw.raw_payload,
  };
}
