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
  stringArray,
  stringOrNull,
  type ProviderFetchResult,
  type RawVehicleListing,
  type VehicleTarget,
} from "./types";

const MARKETCHECK_URL = "https://api.marketcheck.com/v2/search/car/active";
const PAGE_SIZE = 50;

export const MARKETCHECK_PROVIDER = "marketcheck" as const;

export function mapMarketCheckListing(value: unknown): RawVehicleListing | null {
  const listing = recordOrEmpty(value);
  const build = recordOrEmpty(listing.build);
  const dealer = recordOrEmpty(listing.dealer);
  const media = recordOrEmpty(listing.media);
  const vin = stringOrNull(listing.vin) ?? stringOrNull(build.vin);
  const externalId = stringOrNull(listing.id) ?? vin;
  const make = stringOrNull(build.make) ?? stringOrNull(listing.make);
  const model = stringOrNull(build.model) ?? stringOrNull(listing.model);
  const year = numberOrNull(build.year) ?? numberOrNull(listing.year) ?? undefined;

  if (!externalId || !make || !model || year === undefined) return null;

  const photoUrls = Array.from(
    new Set([
      ...stringArray(media.photo_links_cached),
      ...stringArray(media.photo_links),
    ]),
  ).slice(0, 12);

  return {
    provider: MARKETCHECK_PROVIDER,
    external_id: externalId,
    vin,
    year,
    make,
    model,
    trim: stringOrNull(build.trim) ?? stringOrNull(listing.trim),
    body_type:
      stringOrNull(build.body_type) ?? stringOrNull(listing.body_type),
    price: numberOrNull(listing.price),
    mileage: numberOrNull(listing.miles),
    city: stringOrNull(dealer.city) ?? "San Antonio",
    state: stringOrNull(dealer.state) ?? "TX",
    postal_code: stringOrNull(dealer.zip),
    lat: numberOrNull(dealer.latitude),
    lon: numberOrNull(dealer.longitude),
    dealer_name: stringOrNull(dealer.name) ?? "Unknown dealer",
    is_dealer: stringOrNull(listing.seller_type)?.toLowerCase() !== "fsbo",
    listing_url: stringOrNull(listing.vdp_url),
    title_status: listing.carfax_clean_title === true ? "clean" : "unknown",
    image_urls: photoUrls,
    raw_payload: listing,
  };
}

export async function fetchMarketCheckListings(
  apiKey: string,
  targets: readonly VehicleTarget[] = TARGET_VEHICLES,
): Promise<ProviderFetchResult> {
  if (!apiKey.trim()) throw new Error("MARKETCHECK_API_KEY is not configured");

  const listings: RawVehicleListing[] = [];
  let sourceCount = 0;
  let excludedOverPrice = 0;
  let excludedInvalid = 0;

  for (const target of targets) {
    let start = 0;
    let targetCount = 0;

    while (start < MAX_ROWS_PER_TARGET) {
      const rows = Math.min(PAGE_SIZE, MAX_ROWS_PER_TARGET - start);
      const url = new URL(MARKETCHECK_URL);
      const parameters: Record<string, string> = {
        api_key: apiKey,
        append_api_key: "false",
        car_type: "used",
        make: target.make,
        model: target.model,
        year_range: `${target.yearMin ?? MIN_MODEL_YEAR}-${new Date().getUTCFullYear()}`,
        price_range: `${MIN_LISTING_PRICE}-${target.priceMax ?? MAX_LISTING_PRICE}`,
        miles_range: `0-${target.mileageMax ?? MAX_LISTING_MILEAGE}`,
        zip: SEARCH_POSTAL_CODE,
        radius: String(SEARCH_RADIUS_MILES),
        rows: String(rows),
        start: String(start),
      };
      for (const [name, value] of Object.entries(parameters)) {
        url.searchParams.set(name, value);
      }

      const payload = recordOrEmpty(
        await fetchJsonWithRetry(
          url,
          { headers: { Accept: "application/json" } },
          "MarketCheck",
          apiKey,
        ),
      );
      const pageListings = Array.isArray(payload.listings) ? payload.listings : [];
      if (start === 0) {
        targetCount = numberOrNull(payload.num_found) ?? pageListings.length;
        sourceCount += targetCount;
      }

      for (const value of pageListings) {
        const mapped = mapMarketCheckListing(value);
        if (!mapped) {
          excludedInvalid += 1;
          continue;
        }
        const price = numberOrNull(mapped.price);
        if (price !== null && price > MAX_LISTING_PRICE) {
          excludedOverPrice += 1;
          continue;
        }
        if (!isEligibleListing(mapped, targets)) {
          excludedInvalid += 1;
          continue;
        }
        listings.push(mapped);
      }

      start += pageListings.length;
      if (pageListings.length < rows || start >= targetCount) break;
    }
  }

  return {
    provider: MARKETCHECK_PROVIDER,
    listings,
    sourceCount,
    excludedOverPrice,
    excludedInvalid,
  };
}
