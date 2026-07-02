import type { InsertListing } from "@shared/schema";
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

export function sanitizePrice(price: any): number | null {
  if (price == null) return null;
  const n = typeof price === "string" ? parseFloat(price.replace(/[^0-9.]/g, "")) : Number(price);
  if (isNaN(n) || n <= 0 || n > 500000) return null;
  return Math.round(n * 100) / 100;
}

export function sanitizeMileage(mileage: any): number | null {
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

export function normalizeListing(raw: any, source: string): InsertListing {
  const make = normalizeMake(raw.make || raw.Make || "");
  const model = normalizeModel(raw.model || raw.Model || "");
  const city = raw.city || raw.City || null;
  const state = raw.state || raw.State || "TX";

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
    externalId: raw.external_id || raw.id?.toString() || null,
    vin: raw.vin || raw.VIN || null,
    year: parseInt(raw.year || raw.Year, 10),
    make,
    model,
    trim: raw.trim || raw.Trim || null,
    bodyType: raw.body_type || raw.bodyType || null,
    price: sanitizePrice(raw.price || raw.Price),
    mileage: sanitizeMileage(raw.mileage || raw.Mileage || raw.miles),
    city: city ? titleCase(city) : null,
    state: state ? state.toUpperCase() : null,
    postalCode: raw.postal_code || raw.zip || null,
    lat,
    lon,
    dealerName: raw.dealer_name || raw.dealerName || null,
    isDealer: raw.is_dealer ?? raw.isDealer ?? (raw.dealer_name ? true : false),
    listingUrl: raw.listing_url || raw.listingUrl || raw.url || null,
    titleStatus: (raw.title_status || raw.titleStatus || "clean").toLowerCase(),
    imageUrls: raw.image_urls || raw.imageUrls || raw.images || [],
    rawPayload: raw,
  };
}
