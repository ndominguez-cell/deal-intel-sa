// MarketCheck adapter — Priority #4 from PROJECT_SESSION_LOG.md: "Real
// multi-source listing ingestion (licensed data) for the acquisition side."
//
// Why MarketCheck: the session log's legal notes were explicit — no
// marketplace scraping, use licensed data. MarketCheck is a real, licensed
// automotive-data vendor (api.marketcheck.com) with a documented REST API
// covering active dealer inventory across North America. This file talks to
// their actual documented endpoint (GET /v2/search/car/active) using the
// same "raw fetch, no SDK" pattern as ai-setter.ts and sms.ts.
//
// IMPORTANT — verify before relying on this in production:
// MarketCheck's exact per-listing JSON field names were confirmed against
// their public docs for the request shape (endpoint, query params, and the
// top-level { num_found, listings[] } envelope), but individual listing
// field names (whether year/make/model live at the top level or nested
// under a `build` object, for example) can vary by account/plan and may
// have shifted since. This adapter maps defensively — it tries the flat
// field first and falls back to `build.*` — and logs the raw JSON of the
// very first listing on the first live run (set LIVE_INGEST_DEBUG=true) so
// you can eyeball real field names against what's mapped below and adjust
// mapMarketCheckListing() if anything doesn't line up. Get a MarketCheck
// account and API key before this does anything: docs.marketcheck.com.

const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY;
const MARKETCHECK_URL = "https://api.marketcheck.com/v2/search/car/active";

export function isMarketCheckConfigured(): boolean {
  return Boolean(MARKETCHECK_API_KEY);
}

export interface LiveIngestCriteria {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  carType?: "used" | "new" | "certified";
  make?: string;
  model?: string;
}

// Best-effort mapping from a MarketCheck listing object into the same flat
// shape normalizeListing() already accepts (it understands multiple key
// name variants — see server/engine/normalize.ts — so this only needs to
// hit one of the accepted spellings per field).
function mapMarketCheckListing(mc: any): Record<string, any> {
  const build = mc.build ?? {};
  const dealer = mc.dealer ?? {};
  const media = mc.media ?? {};

  return {
    external_id: mc.id ?? mc.listing_id ?? mc.vin ?? null,
    vin: mc.vin ?? build.vin ?? null,
    year: mc.year ?? build.year ?? null,
    make: mc.make ?? build.make ?? null,
    model: mc.model ?? build.model ?? null,
    trim: mc.trim ?? build.trim ?? null,
    body_type: mc.body_type ?? build.body_type ?? null,
    price: mc.price ?? null,
    mileage: mc.miles ?? mc.mileage ?? null,
    city: mc.city ?? dealer.city ?? null,
    state: mc.state ?? dealer.state ?? null,
    zip: mc.zip ?? dealer.zip ?? null,
    dealer_name: dealer.name ?? mc.dealer_name ?? null,
    is_dealer: mc.seller_type ? mc.seller_type !== "fsbo" : true,
    listing_url: mc.vdp_url ?? mc.listing_url ?? null,
    image_urls: media.photo_links ?? mc.photo_links ?? [],
    title_status: mc.carfax_1_owner === false ? "salvage_unknown" : "clean",
  };
}

// Fetches up to `maxRows` active listings around the given point, paginating
// in batches of 50 (MarketCheck's per-request max). Returns already-mapped
// rows ready for normalizeListing() via the existing runIngestion() pipeline.
export async function fetchLiveListings(
  criteria: LiveIngestCriteria,
  maxRows: number
): Promise<{ rows: Record<string, any>[]; numFound: number; errors: string[] }> {
  const rows: Record<string, any>[] = [];
  const errors: string[] = [];

  if (!isMarketCheckConfigured()) {
    return { rows, numFound: 0, errors: ["MARKETCHECK_API_KEY not set — live ingestion is a no-op"] };
  }

  const pageSize = 50; // MarketCheck's documented per-request maximum
  let start = 0;
  let numFound = 0;
  let firstPage = true;

  while (rows.length < maxRows) {
    const rowsThisPage = Math.min(pageSize, maxRows - rows.length);
    const params = new URLSearchParams({
      api_key: MARKETCHECK_API_KEY!,
      car_type: criteria.carType ?? "used",
      latitude: String(criteria.latitude),
      longitude: String(criteria.longitude),
      radius: String(criteria.radiusMiles),
      rows: String(rowsThisPage),
      start: String(start),
    });
    if (criteria.make) params.set("make", criteria.make);
    if (criteria.model) params.set("model", criteria.model);

    try {
      const res = await fetch(`${MARKETCHECK_URL}?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.text();
        errors.push(`MarketCheck ${res.status}: ${body.slice(0, 300)}`);
        break;
      }
      const data = await res.json();
      numFound = data.num_found ?? numFound;
      const listings: any[] = data.listings ?? [];

      if (firstPage && process.env.LIVE_INGEST_DEBUG === "true" && listings[0]) {
        console.log("[marketcheck] first raw listing (LIVE_INGEST_DEBUG=true):", JSON.stringify(listings[0]).slice(0, 2000));
      }
      firstPage = false;

      if (listings.length === 0) break;
      rows.push(...listings.map(mapMarketCheckListing));
      start += listings.length;

      if (start >= numFound) break;
      // Be polite to the API between pages rather than firing back-to-back.
      await new Promise((r) => setTimeout(r, 250));
    } catch (err: any) {
      errors.push(`MarketCheck fetch error: ${err.message}`);
      break;
    }
  }

  return { rows, numFound, errors };
}
