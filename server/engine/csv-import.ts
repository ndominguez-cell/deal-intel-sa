// Dealer inventory CSV import.
// Real dealer exports (vAuto, HomeNet, Dealer.com, DealerSocket, CDK) all use
// different column names. This maps the common aliases onto the fields the
// normalizer already understands, so a dealer can hand over whatever their
// DMS exports and it just works.

const HEADER_ALIASES: Record<string, string> = {
  // vin
  vin: "vin", "vin#": "vin", vinnumber: "vin",
  // year / make / model / trim
  year: "year", modelyear: "year", yr: "year",
  make: "make", manufacturer: "make",
  model: "model",
  trim: "trim", trimlevel: "trim", series: "trim",
  // body
  body: "body_type", bodytype: "body_type", bodystyle: "body_type", type: "body_type",
  // price — prefer internet/selling price over MSRP
  price: "price", sellingprice: "price", internetprice: "price", listprice: "price",
  askingprice: "price", saleprice: "price", currentprice: "price", advertisedprice: "price",
  // mileage
  mileage: "mileage", miles: "mileage", odometer: "mileage", odo: "mileage",
  // location
  city: "city", state: "state", zip: "postal_code", zipcode: "postal_code", postalcode: "postal_code",
  // identity
  stock: "external_id", "stock#": "external_id", stocknumber: "external_id", stockno: "external_id", id: "external_id",
  // dealer
  dealer: "dealer_name", dealername: "dealer_name", dealership: "dealer_name", storename: "dealer_name",
  // url / images
  url: "listing_url", vdpurl: "listing_url", listingurl: "listing_url", link: "listing_url", detailurl: "listing_url",
  photo: "image_url", photourl: "image_url", imageurl: "image_url", image: "image_url",
  photos: "image_urls", imageurls: "image_urls", imagelist: "image_urls",
  // title
  title: "title_status", titlestatus: "title_status",
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-\.]/g, "").trim();
}

// Minimal RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const src = text.replace(/^\uFEFF/, ""); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

export interface MappedRow {
  raw: Record<string, any>;
  skipped?: string;
}

// Map a raw CSV row's dealer-specific headers onto normalizer-friendly keys.
export function mapDealerRow(
  csvRow: Record<string, string>,
  defaults: { dealerName?: string; city?: string; state?: string }
): MappedRow {
  const mapped: Record<string, any> = {};

  for (const [rawKey, value] of Object.entries(csvRow)) {
    if (value === "" || value == null) continue;
    const canonical = HEADER_ALIASES[normalizeHeader(rawKey)];
    if (!canonical) continue;

    if (canonical === "image_url") {
      mapped.image_urls = [value];
    } else if (canonical === "image_urls") {
      mapped.image_urls = value.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
    } else {
      // First matching alias wins (e.g. don't let MSRP overwrite selling price)
      if (mapped[canonical] == null) mapped[canonical] = value;
    }
  }

  mapped.dealer_name = mapped.dealer_name || defaults.dealerName || null;
  mapped.is_dealer = true;
  mapped.city = mapped.city || defaults.city || "San Antonio";
  mapped.state = mapped.state || defaults.state || "TX";

  const year = parseInt(mapped.year, 10);
  if (!mapped.make || !mapped.model || isNaN(year) || year < 1980 || year > new Date().getFullYear() + 1) {
    return { raw: mapped, skipped: `Missing/invalid year, make, or model (got: ${mapped.year ?? "?"} ${mapped.make ?? "?"} ${mapped.model ?? "?"})` };
  }
  if (!mapped.price && !mapped.vin) {
    return { raw: mapped, skipped: "Row has neither a price nor a VIN — cannot score or dedupe" };
  }

  return { raw: mapped };
}
