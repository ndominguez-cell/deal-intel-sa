// Texas Used Car Market Index.
//
// Built only from MarketCheck endpoints available on standard plans:
//   - /v2/search/car/active   (current dealer inventory: supply, asking prices, DOM)
//   - /v2/search/car/recents  (listings that left the market in the last 90 days)
// Every number in a live report comes from an API response; nothing is interpolated or simulated.

import { fetchJsonWithRetry } from "../sources/http";

export const TX_SEGMENTS = [
  { key: "SUV", bodyTypes: "SUV" },
  { key: "Pickup", bodyTypes: "Pickup" },
  { key: "Sedan", bodyTypes: "Sedan" },
  { key: "Other", bodyTypes: "Hatchback,Coupe,Minivan,Convertible,Cargo Van,Wagon" },
] as const;

export const TX_METROS = [
  { key: "Houston", zip: "77002" },
  { key: "Dallas–Fort Worth", zip: "76011" },
  { key: "San Antonio", zip: "78205" },
  { key: "Austin", zip: "78701" },
  { key: "El Paso", zip: "79901" },
  { key: "Rio Grande Valley", zip: "78501" },
  { key: "Corpus Christi", zip: "78401" },
] as const;

export const METRO_RADIUS_MILES = 35;
export const INDEX_WEEKS = 12;

export interface PriceStats {
  count: number;
  median: number | null;
}

export interface WeekPoint {
  weekStart: string; // YYYY-MM-DD (Monday)
  segments: Record<string, PriceStats>;
}

export interface SeriesPoint {
  weekStart: string;
  index: number;
  soldCount: number;
  segmentMedians: Record<string, number | null>;
  segmentCounts: Record<string, number>;
}

export interface SegmentRow {
  segment: string;
  weight: number;
  activeCount: number;
  sold30d: number;
  medianAsk: number | null;
  medianSold: number | null;
  daysSupply: number | null;
  change4w: number | null;
}

export interface MetroRow {
  metro: string;
  activeCount: number;
  sold30d: number;
  medianAsk: number | null;
  medianSold: number | null;
  priceChange30d: number | null;
  daysSupply: number | null;
  medianDom: number | null;
}

export interface MakeRow {
  make: string;
  activeCount: number;
  sold30d: number;
  daysSupply: number | null;
}

export interface TexasIndexReport {
  region: "TX";
  asOf: string;
  source: "marketcheck" | "demo";
  headline: {
    // null until a live refresh has produced a real weekly series.
    indexValue: number | null;
    change1w: number | null;
    change4w: number | null;
    change12w: number | null;
    medianSoldPrice: number | null;
    medianAskPrice: number | null;
    activeSupply: number;
    sold30d: number;
    daysSupply: number | null;
    medianDom: number | null;
  };
  series: SeriesPoint[];
  segments: SegmentRow[];
  metros: MetroRow[];
  makes: MakeRow[];
  errors: string[];
}

// ── Pure calculations ──────────────────────────────────────────────────

export function pctChange(current: number | null | undefined, prior: number | null | undefined): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

/** Days needed to clear current supply at the trailing-30-day exit rate. */
export function daysSupply(active: number, sold30d: number): number | null {
  if (!sold30d) return null;
  return Math.round(active / (sold30d / 30));
}

/**
 * Fixed-weight, mix-adjusted price index (Laspeyres style).
 * Each segment's weekly median is compared to its base-week median, and the ratios are
 * combined using each segment's share of sold volume across the whole window. A shift in
 * mix (e.g. more trucks sold one week) therefore does not move the index; only prices do.
 * Weeks with too few sales in a segment carry that segment's previous median forward.
 */
export function computeIndexSeries(weeks: WeekPoint[], minSample = 30): { series: SeriesPoint[]; weights: Record<string, number> } {
  const sorted = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const segmentKeys = Array.from(new Set(sorted.flatMap((w) => Object.keys(w.segments))));

  const totals: Record<string, number> = {};
  for (const key of segmentKeys) totals[key] = sorted.reduce((sum, w) => sum + (w.segments[key]?.count ?? 0), 0);
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  const base: Record<string, number> = {};
  for (const key of segmentKeys) {
    const first = sorted.find((w) => (w.segments[key]?.count ?? 0) >= minSample && w.segments[key]?.median);
    if (first) base[key] = first.segments[key].median!;
  }
  const usable = segmentKeys.filter((key) => base[key] && totals[key] > 0);
  const usableTotal = usable.reduce((sum, key) => sum + totals[key], 0);
  const weights: Record<string, number> = {};
  for (const key of segmentKeys) weights[key] = usable.includes(key) && usableTotal ? totals[key] / usableTotal : 0;

  const carried: Record<string, number> = { ...base };
  const series = sorted.map((week) => {
    let value = 0;
    const segmentMedians: Record<string, number | null> = {};
    const segmentCounts: Record<string, number> = {};
    for (const key of segmentKeys) {
      const s = week.segments[key];
      segmentCounts[key] = s?.count ?? 0;
      segmentMedians[key] = s?.median ?? null;
      if (s?.median && s.count >= minSample) carried[key] = s.median;
      if (usable.includes(key)) value += weights[key] * (carried[key] / base[key]);
    }
    return {
      weekStart: week.weekStart,
      index: Math.round(value * 1000) / 10,
      soldCount: Object.values(segmentCounts).reduce((a, b) => a + b, 0),
      segmentMedians,
      segmentCounts,
    };
  });

  return { series, weights: grand ? weights : {} };
}

/** Merge stored weekly observations with a fresh pull; fresh data wins for overlapping weeks. */
export function mergeWeeks(previous: SeriesPoint[] | undefined, fresh: WeekPoint[]): WeekPoint[] {
  const byWeek = new Map<string, WeekPoint>();
  for (const p of previous ?? []) {
    const segments: Record<string, PriceStats> = {};
    for (const key of Object.keys(p.segmentCounts)) segments[key] = { count: p.segmentCounts[key], median: p.segmentMedians[key] ?? null };
    byWeek.set(p.weekStart, { weekStart: p.weekStart, segments });
  }
  for (const w of fresh) byWeek.set(w.weekStart, w);
  return Array.from(byWeek.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** The last `count` complete Monday–Sunday weeks before `now` (UTC). */
export function completeWeeks(now: Date, count: number): Array<{ start: Date; end: Date }> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const thisMonday = new Date(today.getTime() - sinceMonday * 86_400_000);
  const weeks = [];
  for (let i = count; i >= 1; i--) {
    const start = new Date(thisMonday.getTime() - i * 7 * 86_400_000);
    weeks.push({ start, end: new Date(start.getTime() + 6 * 86_400_000) });
  }
  return weeks;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// ── MarketCheck client ─────────────────────────────────────────────────

export type MarketCheckFetch = (path: string, params: Record<string, string | number>) => Promise<any>;

// Shares the inventory sync's retry/timeout helper, which also redacts the key
// (sent in the query string) from any error message stored in a report.
export function createMarketCheckFetch(apiKey: string, baseUrl = "https://api.marketcheck.com"): MarketCheckFetch {
  return async (path, params) => {
    const url = new URL(baseUrl + path);
    url.searchParams.set("api_key", apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    return fetchJsonWithRetry(url, { headers: { Accept: "application/json" } }, "MarketCheck", apiKey);
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const ACTIVE = "/v2/search/car/active";
const RECENTS = "/v2/search/car/recents";

function readStats(payload: any, field: string): PriceStats {
  const s = payload?.stats?.[field];
  return { count: Number(payload?.num_found ?? 0), median: s?.median != null ? Math.round(s.median) : null };
}

function readFacet(payload: any, field: string): Map<string, number> {
  return new Map((payload?.facets?.[field] ?? []).map((f: any) => [String(f.item), Number(f.count)]));
}

// ── Report builder ─────────────────────────────────────────────────────

export async function buildTexasIndex(
  mc: MarketCheckFetch,
  now = new Date(),
  previousSeries?: SeriesPoint[],
  concurrency = 5,
): Promise<TexasIndexReport> {
  const errors: string[] = [];
  const base = { car_type: "used", rows: 0 };
  const tx = { ...base, state: "TX" };
  const sold = { sold: "true" };
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (err: any) { errors.push(`${label}: ${err.message}`); return fallback; }
  };

  // 1. Weekly sold medians per segment → mix-adjusted index.
  const weeks = completeWeeks(now, INDEX_WEEKS);
  const weekTasks = weeks.flatMap((w) => TX_SEGMENTS.map((seg) => ({ w, seg })));
  const weekResults = await mapLimit(weekTasks, concurrency, ({ w, seg }) => safe(
    `week ${isoDay(w.start)} ${seg.key}`,
    async () => readStats(await mc(RECENTS, { ...tx, ...sold, body_type: seg.bodyTypes, last_seen_range: `${ymd(w.start)}-${ymd(w.end)}`, stats: "price" }), "price"),
    { count: 0, median: null },
  ));
  const freshWeeks: WeekPoint[] = weeks.map((w, wi) => ({
    weekStart: isoDay(w.start),
    segments: Object.fromEntries(TX_SEGMENTS.map((seg, si) => [seg.key, weekResults[wi * TX_SEGMENTS.length + si]])),
  }));
  const computed = computeIndexSeries(mergeWeeks(previousSeries, freshWeeks));
  const { weights } = computed;
  // With no segment that has a usable base week the index is undefined, not 0: publish no trend.
  const series = Object.values(weights).some((w) => w > 0) ? computed.series : [];

  // 2. Statewide, segment, metro, and make snapshots.
  type Task = { key: string; run: () => Promise<any> };
  const tasks: Task[] = [
    { key: "state:active", run: () => mc(ACTIVE, { ...tx, stats: "price,dom" }) },
    { key: "state:sold30", run: () => mc(RECENTS, { ...tx, ...sold, last_seen_days: "30-0", stats: "price" }) },
    { key: "makes:active", run: () => mc(ACTIVE, { ...tx, facets: "make|0|25" }) },
    { key: "makes:sold30", run: () => mc(RECENTS, { ...tx, ...sold, last_seen_days: "30-0", facets: "make|0|60" }) },
    ...TX_SEGMENTS.flatMap((seg) => [
      { key: `seg:${seg.key}:active`, run: () => mc(ACTIVE, { ...tx, body_type: seg.bodyTypes, stats: "price" }) },
      { key: `seg:${seg.key}:sold30`, run: () => mc(RECENTS, { ...tx, ...sold, body_type: seg.bodyTypes, last_seen_days: "30-0", stats: "price" }) },
    ]),
    ...TX_METROS.flatMap((m) => {
      const geo = { ...base, zip: m.zip, radius: METRO_RADIUS_MILES };
      return [
        { key: `metro:${m.key}:active`, run: () => mc(ACTIVE, { ...geo, stats: "price,dom" }) },
        { key: `metro:${m.key}:sold30`, run: () => mc(RECENTS, { ...geo, ...sold, last_seen_days: "30-0", stats: "price" }) },
        { key: `metro:${m.key}:sold60`, run: () => mc(RECENTS, { ...geo, ...sold, last_seen_days: "60-31", stats: "price" }) },
      ];
    }),
  ];
  const results = await mapLimit(tasks, concurrency, (t) => safe(t.key, t.run, null));
  const r = Object.fromEntries(tasks.map((t, i) => [t.key, results[i]]));
  const domMedian = (p: any) => (p?.stats?.dom?.median != null ? Math.round(p.stats.dom.median) : null);

  const stateActive = readStats(r["state:active"], "price");
  const stateSold = readStats(r["state:sold30"], "price");

  const segments: SegmentRow[] = TX_SEGMENTS.map((seg) => {
    const active = readStats(r[`seg:${seg.key}:active`], "price");
    const sold30 = readStats(r[`seg:${seg.key}:sold30`], "price");
    const pts = series.map((p) => p.segmentMedians[seg.key]).filter((v): v is number => v != null);
    return {
      segment: seg.key,
      weight: Math.round((weights[seg.key] ?? 0) * 1000) / 1000,
      activeCount: active.count,
      sold30d: sold30.count,
      medianAsk: active.median,
      medianSold: sold30.median,
      daysSupply: daysSupply(active.count, sold30.count),
      change4w: pts.length > 4 ? pctChange(pts[pts.length - 1], pts[pts.length - 5]) : null,
    };
  });

  const metros: MetroRow[] = TX_METROS.map((m) => {
    const active = readStats(r[`metro:${m.key}:active`], "price");
    const sold30 = readStats(r[`metro:${m.key}:sold30`], "price");
    const sold60 = readStats(r[`metro:${m.key}:sold60`], "price");
    return {
      metro: m.key,
      activeCount: active.count,
      sold30d: sold30.count,
      medianAsk: active.median,
      medianSold: sold30.median,
      priceChange30d: pctChange(sold30.median, sold60.median),
      daysSupply: daysSupply(active.count, sold30.count),
      medianDom: domMedian(r[`metro:${m.key}:active`]),
    };
  });

  const activeMakes = readFacet(r["makes:active"], "make");
  const soldMakes = readFacet(r["makes:sold30"], "make");
  const makes: MakeRow[] = Array.from(activeMakes.entries()).map(([make, activeCount]) => {
    const sold30d = soldMakes.get(make) ?? 0;
    return { make, activeCount, sold30d, daysSupply: daysSupply(activeCount, sold30d) };
  });

  const at = (back: number) => series[series.length - 1 - back]?.index ?? null;
  const latest = at(0);
  return {
    region: "TX",
    asOf: now.toISOString(),
    source: "marketcheck",
    headline: {
      indexValue: latest,
      change1w: pctChange(latest, at(1)),
      change4w: pctChange(latest, at(4)),
      change12w: pctChange(latest, at(INDEX_WEEKS - 1)),
      medianSoldPrice: stateSold.median,
      medianAskPrice: stateActive.median,
      activeSupply: stateActive.count,
      sold30d: stateSold.count,
      daysSupply: daysSupply(stateActive.count, stateSold.count),
      medianDom: domMedian(r["state:active"]),
    },
    series,
    segments,
    metros,
    makes,
    errors,
  };
}

// ── Sample report ──────────────────────────────────────────────────────

/**
 * Labeled sample report shown until the first live refresh. Statewide totals come from a
 * real September 2026 MarketCheck pull (~284K active used, ~128K exits in 30 days, ~$25.4K
 * median sold); the segment, metro and make splits are illustrative. There is no trend:
 * the weekly series is empty and every change figure is null, because price movement is
 * never simulated. The UI labels this report as sample data.
 */
export function buildDemoTexasIndex(now = new Date()): TexasIndexReport {
  const segmentShape: Array<[string, number, number, number]> = [
    // segment, active, sold 30d, median sold
    ["SUV", 135800, 63200, 25200],
    ["Pickup", 59400, 27800, 34800],
    ["Sedan", 55200, 25700, 19600],
    ["Other", 28700, 10893, 21400],
  ];
  const soldTotal = segmentShape.reduce((sum, [, , sold30d]) => sum + sold30d, 0);
  const segments: SegmentRow[] = segmentShape.map(([segment, activeCount, sold30d, medianSold]) => ({
    segment,
    weight: Math.round((sold30d / soldTotal) * 1000) / 1000,
    activeCount,
    sold30d,
    medianAsk: Math.round(medianSold * 1.03),
    medianSold,
    daysSupply: daysSupply(activeCount, sold30d),
    change4w: null,
  }));

  const metroShape: Array<[string, number, number, number, number]> = [
    ["Houston", 72000, 33500, 25900, 58],
    ["Dallas–Fort Worth", 81000, 36800, 26800, 55],
    ["San Antonio", 27500, 11900, 24600, 63],
    ["Austin", 21800, 9100, 27400, 66],
    ["El Paso", 9200, 4300, 23100, 61],
    ["Rio Grande Valley", 8100, 3500, 23800, 67],
    ["Corpus Christi", 5600, 2300, 24200, 70],
  ];
  const metros: MetroRow[] = metroShape.map(([metro, activeCount, sold30d, medianSold, medianDom]) => ({
    metro, activeCount, sold30d, medianSold, medianDom,
    medianAsk: Math.round(medianSold * 1.02),
    priceChange30d: null,
    daysSupply: daysSupply(activeCount, sold30d),
  }));

  const makeShape: Array<[string, number, number]> = [
    ["Ford", 38200, 16100], ["Chevrolet", 34900, 15200], ["Toyota", 30100, 15800], ["Nissan", 19400, 9700],
    ["Honda", 15800, 8200], ["Ram", 15300, 6000], ["Jeep", 13100, 5200], ["GMC", 11600, 4700],
    ["Hyundai", 11500, 5600], ["Kia", 10900, 5300], ["Mercedes-Benz", 9400, 3500], ["BMW", 7900, 3100],
    ["Dodge", 7400, 3100], ["Lexus", 6400, 3000], ["Tesla", 4300, 2200],
  ];
  const makes: MakeRow[] = makeShape.map(([make, activeCount, sold30d]) => ({ make, activeCount, sold30d, daysSupply: daysSupply(activeCount, sold30d) }));

  return {
    region: "TX",
    asOf: now.toISOString(),
    source: "demo",
    headline: {
      indexValue: null,
      change1w: null,
      change4w: null,
      change12w: null,
      medianSoldPrice: 25400,
      medianAskPrice: 25700,
      activeSupply: 283981,
      sold30d: 127593,
      daysSupply: daysSupply(283981, 127593),
      medianDom: 120,
    },
    series: [], segments, metros, makes, errors: [],
  };
}
