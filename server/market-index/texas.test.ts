import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoTexasIndex,
  buildTexasIndex,
  completeWeeks,
  computeIndexSeries,
  daysSupply,
  mergeWeeks,
  pctChange,
  type WeekPoint,
} from "./texas";

const week = (weekStart: string, segments: Record<string, [number, number | null]>): WeekPoint => ({
  weekStart,
  segments: Object.fromEntries(Object.entries(segments).map(([k, [count, median]]) => [k, { count, median }])),
});

test("index starts at 100 and tracks a uniform price move", () => {
  const { series } = computeIndexSeries([
    week("2026-07-06", { SUV: [100, 30000], Sedan: [100, 20000] }),
    week("2026-07-13", { SUV: [100, 31500], Sedan: [100, 21000] }),
  ]);
  assert.equal(series[0].index, 100);
  assert.equal(series[1].index, 105);
});

test("a shift in segment mix does not move the index when prices are flat", () => {
  const { series } = computeIndexSeries([
    week("2026-07-06", { Pickup: [100, 40000], Sedan: [300, 20000] }),
    week("2026-07-13", { Pickup: [300, 40000], Sedan: [100, 20000] }),
  ]);
  // A naive all-sales median would jump from $20K to $40K here.
  assert.equal(series[1].index, 100);
});

test("thin weeks carry the prior segment median instead of adding noise", () => {
  const { series } = computeIndexSeries([
    week("2026-07-06", { SUV: [100, 30000] }),
    week("2026-07-13", { SUV: [3, 90000] }),
  ]);
  assert.equal(series[1].index, 100);
});

test("weights reflect each segment's share of sold volume", () => {
  const { weights } = computeIndexSeries([week("2026-07-06", { SUV: [300, 30000], Sedan: [100, 20000] })]);
  assert.equal(weights.SUV, 0.75);
  assert.equal(weights.Sedan, 0.25);
});

test("helpers handle missing data", () => {
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(null, 100), null);
  assert.equal(pctChange(100, 0), null);
  assert.equal(daysSupply(3000, 1500), 60);
  assert.equal(daysSupply(3000, 0), null);
});

test("completeWeeks returns full Monday–Sunday weeks before today", () => {
  const weeks = completeWeeks(new Date("2026-09-28T15:00:00Z"), 2); // a Monday
  assert.deepEqual(weeks.map((w) => w.start.toISOString().slice(0, 10)), ["2026-09-14", "2026-09-21"]);
  assert.equal(weeks[1].end.toISOString().slice(0, 10), "2026-09-27");
});

test("mergeWeeks keeps stored history and prefers fresh observations", () => {
  const { series } = computeIndexSeries([week("2026-06-01", { SUV: [100, 29000] }), week("2026-06-08", { SUV: [100, 29500] })]);
  const merged = mergeWeeks(series, [week("2026-06-08", { SUV: [120, 30000] }), week("2026-06-15", { SUV: [110, 30100] })]);
  assert.deepEqual(merged.map((w) => w.weekStart), ["2026-06-01", "2026-06-08", "2026-06-15"]);
  assert.equal(merged[1].segments.SUV.median, 30000);
});

test("buildTexasIndex queries Texas used inventory and assembles a report", async () => {
  const calls: Array<{ path: string; params: Record<string, string | number> }> = [];
  const mc = async (path: string, params: Record<string, string | number>) => {
    calls.push({ path, params });
    if (params.facets) return { num_found: 10, facets: { make: [{ item: "Ford", count: params.last_seen_days ? 50 : 200 }] } };
    const recents = path.endsWith("/recents");
    return { num_found: recents ? 150 : 600, stats: { price: { median: recents ? 25000 : 26000 }, dom: { median: 44 } } };
  };
  const report = await buildTexasIndex(mc, new Date("2026-09-28T12:00:00Z"));

  assert.equal(report.source, "marketcheck");
  assert.equal(report.series.length, 12);
  assert.equal(report.headline.indexValue, 100);
  assert.equal(report.headline.daysSupply, 120);
  assert.equal(report.headline.medianDom, 44);
  assert.equal(report.metros.length, 7);
  assert.deepEqual(report.makes[0], { make: "Ford", activeCount: 200, sold30d: 50, daysSupply: 120 });
  assert.ok(calls.every((c) => c.params.car_type === "used"));
  assert.ok(calls.filter((c) => !c.params.zip).every((c) => c.params.state === "TX"));
  assert.ok(calls.filter((c) => c.path.endsWith("/recents")).every((c) => !(c.params.stats && c.params.facets)));
  assert.deepEqual(report.errors, []);
});

test("buildTexasIndex records failed calls without aborting the report", async () => {
  const mc = async (_path: string, params: Record<string, string | number>) => {
    if (params.zip === "79901") throw new Error("MarketCheck returned 500");
    return { num_found: 100, stats: { price: { median: 24000 } } };
  };
  const report = await buildTexasIndex(mc, new Date("2026-09-28T12:00:00Z"));
  assert.equal(report.errors.length, 3);
  assert.equal(report.metros.find((m) => m.metro === "El Paso")?.activeCount, 0);
});

test("buildTexasIndex publishes no trend when every weekly call fails", async () => {
  const mc = async (_path: string, params: Record<string, string | number>) => {
    if (params.last_seen_range) throw new Error("MarketCheck returned 500");
    return { num_found: 100, stats: { price: { median: 24000 } } };
  };
  const report = await buildTexasIndex(mc, new Date("2026-09-28T12:00:00Z"));
  assert.deepEqual(report.series, []);
  assert.equal(report.headline.indexValue, null);
  assert.equal(report.headline.change1w, null);
  assert.equal(report.headline.activeSupply, 100);
});

test("sample report is deterministic, labeled, and has no simulated trend", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const a = buildDemoTexasIndex(now);
  assert.equal(a.source, "demo");
  assert.deepEqual(a, buildDemoTexasIndex(now));

  assert.deepEqual(a.series, []);
  assert.equal(a.headline.indexValue, null);
  assert.equal(a.headline.change1w, null);
  assert.equal(a.headline.change4w, null);
  assert.equal(a.headline.change12w, null);
  assert.ok(a.segments.every((s) => s.change4w === null));
  assert.ok(a.metros.every((m) => m.priceChange30d === null));
});

test("sample segment totals add up to the statewide 30-day exits", () => {
  const a = buildDemoTexasIndex(new Date("2026-09-28T12:00:00Z"));
  assert.equal(a.segments.reduce((sum, s) => sum + s.sold30d, 0), a.headline.sold30d);
});
