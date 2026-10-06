import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Info, LineChart as LineChartIcon, Loader2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";

// Mirrors server/market-index/texas.ts (TexasIndexReport).
interface SeriesPoint { weekStart: string; index: number; soldCount: number; segmentMedians: Record<string, number | null>; segmentCounts: Record<string, number> }
interface SegmentRow { segment: string; weight: number; activeCount: number; sold30d: number; medianAsk: number | null; medianSold: number | null; daysSupply: number | null; change4w: number | null }
interface MetroRow { metro: string; activeCount: number; sold30d: number; medianAsk: number | null; medianSold: number | null; priceChange30d: number | null; daysSupply: number | null; medianDom: number | null }
interface MakeRow { make: string; activeCount: number; sold30d: number; daysSupply: number | null }
interface Report {
  asOf: string;
  source: "marketcheck" | "demo";
  headline: {
    indexValue: number | null; change1w: number | null; change4w: number | null; change12w: number | null;
    medianSoldPrice: number | null; medianAskPrice: number | null; activeSupply: number; sold30d: number;
    daysSupply: number | null; medianDom: number | null;
  };
  series: SeriesPoint[];
  segments: SegmentRow[];
  metros: MetroRow[];
  makes: MakeRow[];
  errors: string[];
}

// Terminal palette. The page is always dark, like a market-watch screen.
const C = {
  bg: "#0b1120",
  panel: "#0f172a",
  raised: "#131c31",
  border: "#1e293b",
  text: "#e2e8f0",
  muted: "#94a3b8",
  faint: "#64748b",
  accent: "#3b82f6",
  up: "#10b981",
  down: "#ef4444",
};
// Categorical slots in fixed order; color follows the segment, never its rank.
const SEGMENT_COLORS: Record<string, string> = { SUV: "#3987e5", Pickup: "#d95926", Sedan: "#199e70", Other: "#c98500" };
const AXIS = { fontSize: 11, fill: C.faint };
const NO_TREND = "Trend starts after the first live refresh";

const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const usdK = (v: number | null | undefined) => (v == null ? "—" : `$${(v / 1000).toFixed(1)}K`);
const num = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString());
const compact = (v: number | null | undefined) =>
  v == null ? "—" : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v));
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const tone = (v: number | null | undefined) => (v == null || v === 0 ? C.muted : v > 0 ? C.up : C.down);

function Pct({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={className} style={{ color: C.faint }}>—</span>;
  return (
    <span className={`font-semibold tabular-nums ${className}`} style={{ color: tone(value) }}>
      {value > 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
      <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: C.text }}>{children}</h2>
      {right}
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border text-[11px] font-semibold" style={{ borderColor: C.border }} role="tablist">
      {options.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className="px-2.5 py-1 transition-colors"
          style={value === key ? { background: C.accent, color: "#fff" } : { background: C.raised, color: C.muted }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Stands in for a chart until there is a real weekly series. Trends are never simulated. */
function NoTrend({ className }: { className: string }) {
  return (
    <div className={`${className} flex flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs`} style={{ borderColor: C.border, color: C.faint }}>
      <LineChartIcon className="h-5 w-5" aria-hidden />
      {NO_TREND}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-7 w-16 text-center text-[10px] leading-7" style={{ color: C.faint }}>—</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 64},${26 - ((v - min) / span) * 24}`).join(" ");
  return (
    <svg width="64" height="28" viewBox="0 0 64 28" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TerminalTooltip({ active, payload, label, rows }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border px-3 py-2 text-xs shadow-xl" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
      <div className="mb-1 font-semibold">Week of {shortDate(label)}</div>
      {rows(payload[0].payload, payload).map(([name, value, color]: [string, string, string?]) => (
        <div key={name} className="flex items-center gap-2" style={{ color: C.muted }}>
          {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
          <span>{name}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums" style={{ color: C.text }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/** Heatmap cell tint: diverging green/red for price moves, blue ramp for supply-type measures. */
function heat(value: number | null, kind: "change" | "supply", range: [number, number]) {
  if (value == null) return { background: C.raised, color: C.faint };
  if (kind === "change") {
    const a = Math.min(1, Math.abs(value) / Math.max(0.5, Math.max(Math.abs(range[0]), Math.abs(range[1]))));
    const rgb = value >= 0 ? "16,185,129" : "239,68,68";
    return { background: `rgba(${rgb},${0.15 + a * 0.6})`, color: "#fff" };
  }
  const t = range[1] > range[0] ? (value - range[0]) / (range[1] - range[0]) : 0.5;
  return { background: `rgba(59,130,246,${0.12 + t * 0.55})`, color: "#fff" };
}

type Range = "4W" | "8W" | "ALL";
type Mode = "composite" | "segments";
type MoverTab = "fastest" | "slowest" | "active";

export default function TexasIndex() {
  const [range, setRange] = useState<Range>("ALL");
  const [mode, setMode] = useState<Mode>("composite");
  const [moverTab, setMoverTab] = useState<MoverTab>("fastest");
  const query = useQuery<{ report: Report; marketCheckConfigured: boolean }>({
    queryKey: ["/api/market-index/texas"],
    queryFn: () => apiRequest("GET", "/api/market-index/texas"),
  });
  const report = query.data?.report;
  // Only a live report with weekly observations has a trend to show.
  const hasTrend = report?.source === "marketcheck" && report.series.length > 0;

  const series = useMemo(() => {
    if (!report || !hasTrend) return [];
    const weeks = range === "4W" ? 4 : range === "8W" ? 8 : report.series.length;
    return report.series.slice(-weeks);
  }, [report, hasTrend, range]);

  // Each segment's weekly median rebased to 100 at the first week in view, so segments share one axis.
  const segmentSeries = useMemo(() => {
    if (!report) return [];
    const base: Record<string, number> = {};
    return series.map((p) => {
      const row: Record<string, any> = { weekStart: p.weekStart };
      for (const seg of report.segments) {
        const m = p.segmentMedians[seg.segment];
        if (m && !base[seg.segment]) base[seg.segment] = m;
        row[seg.segment] = m && base[seg.segment] ? Math.round((m / base[seg.segment]) * 1000) / 10 : null;
        row[`${seg.segment}__median`] = m;
      }
      return row;
    });
  }, [report, series]);

  // Volume bars colored by the index's direction that week.
  const volume = useMemo(() => series.map((p, i) => ({
    weekStart: p.weekStart,
    soldCount: p.soldCount,
    up: i === 0 ? true : p.index >= series[i - 1].index,
  })), [series]);

  const movers = useMemo(() => {
    if (!report) return [];
    const rows = report.makes.filter((m) => m.daysSupply != null || moverTab === "active");
    if (moverTab === "fastest") rows.sort((a, b) => (a.daysSupply ?? Infinity) - (b.daysSupply ?? Infinity));
    if (moverTab === "slowest") rows.sort((a, b) => (b.daysSupply ?? -1) - (a.daysSupply ?? -1));
    if (moverTab === "active") rows.sort((a, b) => b.sold30d - a.sold30d);
    return rows.slice(0, 10);
  }, [report, moverTab]);

  // Biggest Texas brands by 30-day sales; there is no per-make price series, so no sparkline.
  const watchMakes = report ? [...report.makes].sort((a, b) => b.sold30d - a.sold30d).slice(0, 8) : [];
  const metros = report ? [...report.metros].sort((a, b) => b.sold30d - a.sold30d) : [];
  const metroRange = (pick: (m: MetroRow) => number | null): [number, number] => {
    const vals = metros.map(pick).filter((v): v is number => v != null);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0];
  };
  const chgRange = metroRange((m) => m.priceChange30d);
  const supplyRange = metroRange((m) => m.daysSupply);
  const domRange = metroRange((m) => m.medianDom);

  const indexDelta = hasTrend && series.length > 1 ? series[series.length - 1].index - series[0].index : null;

  return (
    <div className="min-h-screen pb-6" style={{ background: C.bg, color: C.text }}>
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-white" style={{ color: C.muted }}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> DealIntel SA
          </Link>
          <div className="h-5 w-px" style={{ background: C.border }} />
          <h1 className="text-base font-extrabold tracking-wide">TX MARKET INDEX</h1>
          <span className="rounded px-2 py-0.5 text-[10px] font-bold tracking-wider" style={report?.source === "marketcheck"
            ? { background: "rgba(16,185,129,0.12)", color: C.up, border: `1px solid rgba(16,185,129,0.3)` }
            : { background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
            {report?.source === "marketcheck" ? "LIVE" : "SAMPLE"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Toggle value={range} onChange={setRange} options={[["4W", "4W"], ["8W", "8W"], ["ALL", "ALL"]] as const} />
            {report && (
              <span className="hidden text-[11px] sm:inline" style={{ color: C.faint }}>
                Updated {new Date(report.asOf).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>
        </div>

        {/* Ticker strip */}
        {report && (
          <div className="flex items-stretch overflow-x-auto border-t" style={{ borderColor: C.border }}>
            <div className="shrink-0 border-r px-4 py-3" style={{ borderColor: C.border }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.faint }}>TX Used Price Index</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums">{report.headline.indexValue == null ? "—" : report.headline.indexValue.toFixed(2)}</span>
                {hasTrend && <Pct value={report.headline.change1w} className="text-sm" />}
              </div>
              <div className="text-[11px]" style={{ color: C.faint }}>
                {hasTrend ? <>4W <Pct value={report.headline.change4w} /> · {Math.min(report.series.length - 1, 10)}W <Pct value={report.headline.change12w} /></> : NO_TREND}
              </div>
            </div>
            {report.segments.map((s) => (
              <div key={s.segment} className="shrink-0 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.faint }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEGMENT_COLORS[s.segment] }} aria-hidden />
                  {s.segment} Index
                </div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{usdK(s.medianSold)}</div>
                <Pct value={hasTrend ? s.change4w : null} className="text-[11px]" />
              </div>
            ))}
            <div className="shrink-0 border-l px-4 py-3" style={{ borderColor: C.border }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.faint }}>Volume (30D)</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{compact(report.headline.sold30d)}</div>
              <div className="text-[11px]" style={{ color: C.faint }}>{compact(report.headline.activeSupply)} active</div>
            </div>
            <div className="shrink-0 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.faint }}>Days Supply</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{num(report.headline.daysSupply)}</div>
              <div className="text-[11px]" style={{ color: C.faint }}>DOM {num(report.headline.medianDom)}</div>
            </div>
            <div className="shrink-0 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.faint }}>Median Sold / Ask</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{usdK(report.headline.medianSoldPrice)}</div>
              <div className="text-[11px]" style={{ color: C.faint }}>Ask {usdK(report.headline.medianAskPrice)}</div>
            </div>
          </div>
        )}
      </header>

      {query.isLoading && (
        <div className="flex items-center gap-2 p-6 text-sm" style={{ color: C.muted }}><Loader2 className="h-4 w-4 animate-spin" /> Loading index…</div>
      )}
      {query.isError && (
        <div className="m-4 rounded-md border p-4 text-sm" style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>
          The index could not be loaded. Try again shortly.
        </div>
      )}

      {report && (
        <>
          {report.source === "demo" && (
            <div className="border-b px-4 py-2 text-xs" style={{ borderColor: C.border, background: "rgba(245,158,11,0.08)", color: "#fcd34d" }}>
              <strong>Sample data.</strong> Statewide totals reflect a real September 2026 MarketCheck pull; segment, metro and make splits are illustrative. No price trend is shown until live data exists.
              {query.data?.marketCheckConfigured
                ? " A MarketCheck key is configured; live data publishes after the next weekly refresh (Tuesdays, 11:15 UTC)."
                : " Set MARKETCHECK_API_KEY and run the refresh to publish live data."}
            </div>
          )}
          {report.errors.length > 0 && (
            <div className="border-b px-4 py-2 text-xs" style={{ borderColor: C.border, color: C.muted }}>
              {report.errors.length} MarketCheck request{report.errors.length === 1 ? "" : "s"} failed in the last refresh; affected cells show “—”.
            </div>
          )}

          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* Main column */}
            <div className="min-w-0 lg:border-r" style={{ borderColor: C.border }}>
              <section className="border-b" style={{ borderColor: C.border }}>
                <SectionTitle right={<Toggle value={mode} onChange={setMode} options={[["composite", "Composite"], ["segments", "Segments (100)"]] as const} />}>
                  TX Used Price Index — History
                  {indexDelta != null && mode === "composite" && (
                    <span className="ml-2 text-xs font-semibold normal-case" style={{ color: tone(indexDelta) }}>
                      {indexDelta > 0 ? "+" : ""}{indexDelta.toFixed(2)} pts in view
                    </span>
                  )}
                </SectionTitle>
                <div className="px-2 pb-2">
                  {!hasTrend ? <NoTrend className="mx-2 mb-2 h-72" /> : (
                    <>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          {mode === "composite" ? (
                            <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} syncId="tx">
                              <defs>
                                <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke={C.border} vertical={false} />
                              <XAxis dataKey="weekStart" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                              <YAxis domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} tick={AXIS} axisLine={false} tickLine={false} width={48} />
                              <Tooltip
                                cursor={{ stroke: C.faint, strokeWidth: 1 }}
                                content={<TerminalTooltip rows={(p: SeriesPoint) => [["Index", p.index.toFixed(2), C.accent], ["Sold", p.soldCount.toLocaleString()]]} />}
                              />
                              <Area type="monotone" dataKey="index" stroke={C.accent} strokeWidth={2} fill="url(#txFill)" activeDot={{ r: 4, stroke: C.panel, strokeWidth: 2 }} />
                            </AreaChart>
                          ) : (
                            <LineChart data={segmentSeries} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} syncId="tx">
                              <CartesianGrid stroke={C.border} vertical={false} />
                              <XAxis dataKey="weekStart" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                              <YAxis domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} tick={AXIS} axisLine={false} tickLine={false} width={48} />
                              <Tooltip
                                cursor={{ stroke: C.faint, strokeWidth: 1 }}
                                content={<TerminalTooltip rows={(row: any) => report.segments.map((s) => [s.segment, `${row[s.segment]?.toFixed(1) ?? "—"} · ${usd(row[`${s.segment}__median`])}`, SEGMENT_COLORS[s.segment]])} />}
                              />
                              {report.segments.map((s) => (
                                <Line key={s.segment} type="monotone" dataKey={s.segment} name={s.segment} stroke={SEGMENT_COLORS[s.segment]} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 3, stroke: C.panel, strokeWidth: 2 }} />
                              ))}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                      {mode === "segments" && (
                        <div className="flex flex-wrap gap-4 px-4 pt-1 text-[11px]" style={{ color: C.muted }}>
                          {report.segments.map((s) => (
                            <span key={s.segment} className="inline-flex items-center gap-1.5">
                              <span className="h-0.5 w-4 rounded" style={{ background: SEGMENT_COLORS[s.segment] }} aria-hidden />{s.segment}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Volume strip: its own chart and axis, sharing the time scale. */}
                      <div className="mt-1 h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={volume} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} syncId="tx">
                            <XAxis dataKey="weekStart" hide />
                            <YAxis width={48} tick={false} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={() => null} />
                            <Bar dataKey="soldCount" radius={[3, 3, 0, 0]}>
                              {volume.map((v) => <Cell key={v.weekStart} fill={v.up ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="px-4 pb-1 text-[10px] uppercase tracking-wider" style={{ color: C.faint }}>Weekly sold volume</div>
                    </>
                  )}
                </div>
              </section>

              <div className="grid min-w-0 xl:grid-cols-2">
                {/* Metro heatmap */}
                <section className="min-w-0 border-b xl:border-r" style={{ borderColor: C.border }}>
                  <SectionTitle>Metro Heatmap</SectionTitle>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full min-w-[420px] border-separate text-xs" style={{ borderSpacing: 2 }}>
                      <thead>
                        <tr style={{ color: C.faint }}>
                          <th className="px-2 py-1 text-left font-semibold uppercase">Metro</th>
                          <th className="px-2 py-1 text-center font-semibold uppercase">30D Price</th>
                          <th className="px-2 py-1 text-center font-semibold uppercase">Days Supply</th>
                          <th className="px-2 py-1 text-center font-semibold uppercase">Median DOM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metros.map((m) => (
                          <tr key={m.metro}>
                            <td className="whitespace-nowrap px-2 py-1.5 font-semibold" style={{ color: C.text }}>{m.metro}</td>
                            <td className="rounded px-2 py-1.5 text-center font-bold tabular-nums" style={heat(m.priceChange30d, "change", chgRange)}>
                              {m.priceChange30d == null ? "—" : `${m.priceChange30d > 0 ? "+" : ""}${m.priceChange30d.toFixed(1)}%`}
                            </td>
                            <td className="rounded px-2 py-1.5 text-center font-bold tabular-nums" style={heat(m.daysSupply, "supply", supplyRange)}>{num(m.daysSupply)}</td>
                            <td className="rounded px-2 py-1.5 text-center font-bold tabular-nums" style={heat(m.medianDom, "supply", domRange)}>{num(m.medianDom)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[10px]" style={{ color: C.faint }}>Green/red = median sold price vs prior 30 days. Deeper blue = more supply / longer on market.</p>
                  </div>
                </section>

                {/* Metro comparison */}
                <section className="min-w-0 border-b" style={{ borderColor: C.border }}>
                  <SectionTitle>Metro Comparison</SectionTitle>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: C.border, color: C.faint }}>
                          <th className="py-1.5 text-left font-semibold uppercase">Metro</th>
                          <th className="py-1.5 text-right font-semibold uppercase">Med. Sold</th>
                          <th className="py-1.5 text-right font-semibold uppercase">Volume</th>
                          <th className="py-1.5 text-right font-semibold uppercase">Active</th>
                          <th className="py-1.5 text-right font-semibold uppercase">Change %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metros.map((m) => (
                          <tr key={m.metro} className="border-b last:border-0" style={{ borderColor: "rgba(30,41,59,0.6)" }}>
                            <td className="py-2 font-medium" style={{ color: C.text }}>{m.metro}</td>
                            <td className="py-2 text-right font-bold tabular-nums">{usd(m.medianSold)}</td>
                            <td className="py-2 text-right tabular-nums" style={{ color: C.muted }}>{compact(m.sold30d)}</td>
                            <td className="py-2 text-right tabular-nums" style={{ color: C.muted }}>{compact(m.activeCount)}</td>
                            <td className="py-2 text-right"><Pct value={m.priceChange30d} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>

            {/* Movers sidebar */}
            <aside className="border-b lg:border-b-0" style={{ borderColor: C.border }}>
              <div className="flex border-b" style={{ borderColor: C.border }} role="tablist">
                {([["fastest", "Fastest"], ["slowest", "Slowest"], ["active", "Most Sold"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={moverTab === key}
                    onClick={() => setMoverTab(key)}
                    className="flex-1 border-b-2 px-2 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors"
                    style={moverTab === key ? { borderColor: C.accent, color: C.text } : { borderColor: "transparent", color: C.faint }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ol>
                {movers.map((m, i) => (
                  <li key={m.make} className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: C.border }}>
                    <span className="w-4 text-xs tabular-nums" style={{ color: C.faint }}>{i + 1}</span>
                    <BrandMark make={m.make} color={C.text} background={C.raised} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{m.make}</div>
                      <div className="text-[11px]" style={{ color: C.faint }}>Vol {compact(m.sold30d)} · {compact(m.activeCount)} active</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums">{num(m.daysSupply)}d</div>
                      <div className="text-[10px] uppercase" style={{ color: C.faint }}>supply</div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="px-4 py-3 text-[10px]" style={{ color: C.faint }}>Days supply = active listings ÷ daily exits over the last 30 days. Lower turns faster.</p>
            </aside>
          </div>

          {/* Watchlist */}
          <div className="flex items-center gap-3 overflow-x-auto border-b px-4 py-3" style={{ borderColor: C.border, background: C.panel }}>
            <span className="w-[68px] shrink-0 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.faint }}>Watchlist</span>
            {report.segments.map((s) => {
              const values = series.map((p) => p.segmentMedians[s.segment]).filter((v): v is number => v != null);
              return (
                <div key={s.segment} className="flex shrink-0 items-center gap-3 rounded-md border px-3 py-2" style={{ borderColor: C.border, background: C.raised }}>
                  <div>
                    <div className="text-xs font-bold">{s.segment}</div>
                    <div className="text-[11px] tabular-nums" style={{ color: C.faint }}>{usdK(s.medianSold)}</div>
                  </div>
                  <Sparkline values={hasTrend ? values : []} color={tone(hasTrend ? s.change4w : null)} />
                  <Pct value={hasTrend ? s.change4w : null} className="text-xs" />
                </div>
              );
            })}
          </div>
          {watchMakes.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto border-b px-4 py-3" style={{ borderColor: C.border, background: C.panel }}>
            <span className="w-[68px] shrink-0 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.faint }}>Brands</span>
            {watchMakes.map((m) => (
              <div key={m.make} className="flex shrink-0 items-center gap-2.5 rounded-md border px-3 py-2" style={{ borderColor: C.border, background: C.raised }}>
                <BrandMark make={m.make} color={C.text} background={C.panel} />
                <div>
                  <div className="text-xs font-bold">{m.make}</div>
                  <div className="text-[11px] tabular-nums" style={{ color: C.faint }}>Vol {compact(m.sold30d)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold tabular-nums">{num(m.daysSupply)}d</div>
                  <div className="text-[10px] uppercase" style={{ color: C.faint }}>supply</div>
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="flex gap-3 px-4 py-4 text-[11px] leading-relaxed" style={{ color: C.faint }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              <strong style={{ color: C.muted }}>Methodology.</strong> Sales are MarketCheck dealer listings that left the market (sold or delisted) in each Monday–Sunday week.
              The index is a fixed-weight average of each segment's median sold price relative to its base week, weighted by segment share of sales, so a week with more trucks sold doesn't read as a price rise.
              MarketCheck confirms a sale about a week after the car leaves the lot, so sales figures end eight days ago and a week joins the chart once it is fully reported. Segments with fewer than 30 sales in a week carry their previous median. Asking prices and days on market come from current active inventory.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
