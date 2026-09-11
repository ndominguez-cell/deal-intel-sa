import { fetchJsonWithRetry } from "./http";
import {
  MAX_LISTING_MILEAGE,
  MAX_LISTING_PRICE,
  MAX_ROWS_PER_TARGET,
  MIN_LISTING_PRICE,
  MIN_MODEL_YEAR,
  SEARCH_POSTAL_CODE,
  SEARCH_RADIUS_MILES,
  TARGET_VEHICLES,
  isEligibleListing,
  numberOrNull,
  recordOrEmpty,
  stringOrNull,
  type ProviderFetchResult,
  type RawVehicleListing,
} from "./types";

const AUTODEV_URL = "https://api.auto.dev/listings";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_TARGET = 10;

export const AUTODEV_PROVIDER = "autodev" as const;

export function mapAutoDevListing(value: unknown): RawVehicleListing | null {
  const listing = recordOrEmpty(value);
  const vehicle = recordOrEmpty(listing.vehicle);
  const retail = recordOrEmpty(listing.retailListing);
  const location = Array.isArray(listing.location) ? listing.location : [];
  const vin = stringOrNull(listing.vin) ?? stringOrNull(vehicle.vin);
  const externalId = vin ?? stringOrNull(listing["@id"]);
  const make = stringOrNull(vehicle.make);
  const model = stringOrNull(vehicle.model);
  const year = numberOrNull(vehicle.year) ?? undefined;

  if (!externalId || !make || !model || year === undefined) return null;
  if (retail.used === false) return null;

  const primaryImage = stringOrNull(retail.primaryImage);

  return {
    provider: AUTODEV_PROVIDER,
    external_id: externalId,
    vin,
    year,
    make,
    model,
    trim: stringOrNull(vehicle.trim) ?? stringOrNull(vehicle.series),
    body_type: stringOrNull(vehicle.bodyStyle) ?? stringOrNull(vehicle.type),
    price: numberOrNull(retail.price),
    mileage: numberOrNull(retail.miles),
    city: stringOrNull(retail.city) ?? "San Antonio",
    state: stringOrNull(retail.state) ?? "TX",
    postal_code: stringOrNull(retail.zip),
    lat: numberOrNull(location[1]),
    lon: numberOrNull(location[0]),
    dealer_name: stringOrNull(retail.dealer) ?? "Unknown dealer",
    is_dealer: true,
    listing_url: stringOrNull(retail.vdp),
    title_status: "unknown",
    image_urls: primaryImage?.startsWith("http") ? [primaryImage] : [],
    raw_payload: listing,
  };
}

function initialUrl(target: (typeof TARGET_VEHICLES)[number]): URL {
  const url = new URL(AUTODEV_URL);
  const parameters: Record<string, string> = {
    page: "1",
    limit: String(PAGE_SIZE),
    sort: "updatedAt.desc",
    "vehicle.make": target.make,
    "vehicle.model": target.model,
    "vehicle.year": `${MIN_MODEL_YEAR}-${new Date().getUTCFullYear()}`,
    "retailListing.price": `${MIN_LISTING_PRICE}-${MAX_LISTING_PRICE}`,
    "retailListing.miles": `0-${MAX_LISTING_MILEAGE}`,
    "retailListing.used": "true",
    zip: SEARCH_POSTAL_CODE,
    distance: String(SEARCH_RADIUS_MILES),
    includeUnpriced: "false",
    includes: "total",
  };
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }
  return url;
}

function nextAutoDevUrl(value: unknown): URL | null {
  const href = stringOrNull(value);
  if (!href) return null;
  const url = new URL(href, AUTODEV_URL);
  if (url.origin !== new URL(AUTODEV_URL).origin) {
    throw new Error("Auto.dev returned an unexpected pagination origin");
  }
  return url;
}

export async function fetchAutoDevListings(
  apiKey: string,
): Promise<ProviderFetchResult> {
  if (!apiKey.trim()) throw new Error("AUTODEV_API_KEY is not configured");

  const listings: RawVehicleListing[] = [];
  let sourceCount = 0;
  let excludedOverPrice = 0;
  let excludedInvalid = 0;

  for (const target of TARGET_VEHICLES) {
    let pageUrl: URL | null = initialUrl(target);
    let fetchedForTarget = 0;
    let reportedTargetCount: number | null = null;
    let pageNumber = 0;

    while (
      pageUrl &&
      fetchedForTarget < MAX_ROWS_PER_TARGET &&
      pageNumber < MAX_PAGES_PER_TARGET
    ) {
      pageNumber += 1;
      const payload = recordOrEmpty(
        await fetchJsonWithRetry(
          pageUrl,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
          },
          "Auto.dev",
          apiKey,
        ),
      );
      const pageListings = Array.isArray(payload.data) ? payload.data : [];
      if (reportedTargetCount === null) {
        reportedTargetCount = numberOrNull(payload.total);
      }

      for (const value of pageListings) {
        if (fetchedForTarget >= MAX_ROWS_PER_TARGET) break;
        fetchedForTarget += 1;
        const mapped = mapAutoDevListing(value);
        if (!mapped) {
          excludedInvalid += 1;
          continue;
        }
        const price = numberOrNull(mapped.price);
        if (price !== null && price > MAX_LISTING_PRICE) {
          excludedOverPrice += 1;
          continue;
        }
        if (!isEligibleListing(mapped)) {
          excludedInvalid += 1;
          continue;
        }
        listings.push(mapped);
      }

      const links = recordOrEmpty(payload.links);
      pageUrl = nextAutoDevUrl(links.next);
      if (pageListings.length === 0) break;
    }

    sourceCount += reportedTargetCount ?? fetchedForTarget;
  }

  return {
    provider: AUTODEV_PROVIDER,
    listings,
    sourceCount,
    excludedOverPrice,
    excludedInvalid,
  };
}
