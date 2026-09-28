import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, Car, Info, LineChart as LineChartIcon, Loader2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api";

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

// Categorical slots 1–4 in fixed order; color follows the segment, never its rank.
const SEGMENT_COLORS: Record<string, string> = { SUV: "#2a78d6", Pickup: "#eb6834", Sedan: "#1baf7a", Other: "#eda100" };
const INDEX_COLOR = "#2a78d6";
const GRID = "hsl(var(--border))";
const AXIS = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
const NO_TREND = "The trend appears after the first live refresh.";

const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const num = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString());
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Change({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const up = value > 0;
  const flat = value === 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${flat ? "text-muted-foreground" : up ? "text-emerald-500" : "text-rose-500"}`}>
      {!flat && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {up ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

/** Buyer's / balanced / seller's market read from days of supply. */
function supplyLabel(days: number | null) {
  if (days == null) return { text: "—", cls: "text-muted-foreground" };
  if (days < 45) return { text: "Tight", cls: "bg-rose-500/10 text-rose-500" };
  if (days <= 75) return { text: "Balanced", cls: "bg-muted text-muted-foreground" };
  return { text: "Oversupplied", cls: "bg-blue-500/10 text-blue-500" };
}

function SupplyBadge({ days }: { days: number | null }) {
  const l = supplyLabel(days);
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {num(days)}
      {days != null && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.cls}`}>{l.text}</span>}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Stands in for a chart until there is a real weekly series. Trends are never simulated. */
function NoTrend({ height }: { height: string }) {
  return (
    <div className={`${height} flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground`}>
      <LineChartIcon className="h-5 w-5" aria-hidden />
      {NO_TREND}
    </div>
  );
}

function ChartTooltip({ active, payload, label, format }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-foreground">Week of {shortDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums text-foreground">{format(p.value, p.payload, p.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

function PageHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-card/50 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Car className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-xl font-bold leading-none tracking-tight">DealIntel<span className="text-primary">SA</span></div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Automotive Market Intelligence</p>
          </div>
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          San Antonio deals
        </Link>
      </div>
    </header>
  );
}

export default function TexasIndex() {
  const [makeSort, setMakeSort] = useState<"volume" | "fastest" | "slowest">("volume");
  const query = useQuery<{ report: Report; marketCheckConfigured: boolean }>({
    queryKey: ["/api/market-index/texas"],
    queryFn: () => apiRequest("GET", "/api/market-index/texas"),
  });
  const report = query.data?.report;
  // Only a live report with weekly observations has a trend to show.
  const hasTrend = report?.source === "marketcheck" && report.series.length > 0;

  // Rebase each segment's weekly median to 100 at its first observation so segments share one axis.
  const segmentSeries = useMemo(() => {
    if (!report) return [];
    const base: Record<string, number> = {};
    return report.series.map((p) => {
      const row: Record<string, any> = { weekStart: p.weekStart };
      for (const seg of report.segments) {
        const m = p.segmentMedians[seg.segment];
        if (m && !base[seg.segment]) base[seg.segment] = m;
        row[seg.segment] = m && base[seg.segment] ? Math.round((m / base[seg.segment]) * 1000) / 10 : null;
        row[`${seg.segment}__median`] = m;
      }
      return row;
    });
  }, [report]);

  const makes = useMemo(() => {
    if (!report) return [];
    const rows = [...report.makes];
    if (makeSort === "volume") rows.sort((a, b) => b.activeCount - a.activeCount);
    if (makeSort === "fastest") rows.sort((a, b) => (a.daysSupply ?? Infinity) - (b.daysSupply ?? Infinity));
    if (makeSort === "slowest") rows.sort((a, b) => (b.daysSupply ?? -1) - (a.daysSupply ?? -1));
    return rows.slice(0, 15);
  }, [report, makeSort]);
  const maxMakeSupply = Math.max(1, ...makes.map((m) => m.daysSupply ?? 0));

  return (
    <div className="min-h-screen bg-background pb-12">
      <PageHeader />
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Market Intelligence</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Texas Used Car Market Index</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Weekly, mix-adjusted price index of used vehicles leaving Texas dealer lots, with supply and demand by segment, metro, and make.
            </p>
          </div>
          {report && (
            <div className="text-xs text-muted-foreground sm:text-right">
              {report.source === "marketcheck" ? "Source: MarketCheck" : (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-200">Sample data</span>
              )} · Updated {new Date(report.asOf).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          )}
        </div>

        {query.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading index…</div>
        )}
        {query.isError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300">The index could not be loaded. Try again shortly.</div>
        )}

        {report?.source === "demo" && (
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <strong>Sample data.</strong> Statewide totals reflect a real September 2026 MarketCheck pull; the segment, metro and make splits are illustrative.
              No price trend is shown until live data exists, so index values and changes read “—”.
              {query.data?.marketCheckConfigured
                ? " A MarketCheck key is configured; live data publishes after the next daily refresh or a manual one."
                : " Set MARKETCHECK_API_KEY and run the refresh to publish live data."}
            </div>
          </div>
        )}
        {report && report.errors.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {report.errors.length} MarketCheck request{report.errors.length === 1 ? "" : "s"} failed in the last refresh; affected cells show “—”.
          </div>
        )}

        {report && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="TX Used Price Index"
                value={report.headline.indexValue == null ? "—" : report.headline.indexValue.toFixed(1)}
                sub={hasTrend
                  ? <span className="flex flex-wrap gap-x-3">1 wk <Change value={report.headline.change1w} /> 4 wk <Change value={report.headline.change4w} /> 12 wk <Change value={report.headline.change12w} /></span>
                  : NO_TREND}
              />
              <Stat
                label="Median sold price (30 days)"
                value={usd(report.headline.medianSoldPrice)}
                sub={<>Median asking {usd(report.headline.medianAskPrice)}</>}
              />
              <Stat
                label="Days of supply"
                value={num(report.headline.daysSupply)}
                sub={<>{supplyLabel(report.headline.daysSupply).text} · median {num(report.headline.medianDom)} days on market</>}
              />
              <Stat
                label="Active used listings"
                value={num(report.headline.activeSupply)}
                sub={<>{num(report.headline.sold30d)} sold or delisted in 30 days</>}
              />
            </div>

            <Panel
              title="TX Used Price Index"
              subtitle={hasTrend
                ? `Base = 100 at week of ${shortDate(report.series[0].weekStart)}. Segment-weighted, so shifts in what sold don't move it — only prices do.`
                : "Segment-weighted, so shifts in what sold don't move it — only prices do."}
            >
              {hasTrend ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="weekStart" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} tick={AXIS} axisLine={false} tickLine={false} width={44} />
                      <Tooltip
                        cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                        content={<ChartTooltip format={(v: number, p: SeriesPoint) => `${v.toFixed(1)} · ${p.soldCount.toLocaleString()} sold`} />}
                      />
                      <Line type="monotone" dataKey="index" name="TX index" stroke={INDEX_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <NoTrend height="h-72" />}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <Panel title="Segment price indices" subtitle="Each segment's weekly median sold price, rebased to 100.">
                  {hasTrend ? (
                    <>
                      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {report.segments.map((s) => (
                          <span key={s.segment} className="inline-flex items-center gap-1.5">
                            <span className="h-0.5 w-4 rounded" style={{ background: SEGMENT_COLORS[s.segment] }} aria-hidden />
                            {s.segment}
                          </span>
                        ))}
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={segmentSeries} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke={GRID} vertical={false} />
                            <XAxis dataKey="weekStart" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                            <YAxis domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} tick={AXIS} axisLine={false} tickLine={false} width={44} />
                            <Tooltip
                              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                              content={<ChartTooltip format={(v: number, row: any, key: string) => `${v?.toFixed(1) ?? "—"} · ${usd(row[`${key}__median`])}`} />}
                            />
                            {report.segments.map((s) => (
                              <Line key={s.segment} type="monotone" dataKey={s.segment} name={s.segment} stroke={SEGMENT_COLORS[s.segment]} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : <NoTrend height="h-64" />}
                </Panel>
              </div>
              <div className="lg:col-span-2">
                <Panel title="Segments" subtitle="Weight = share of sold volume in the index.">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3">Segment</th>
                          <th className="py-2 pr-3 text-right">Median sold</th>
                          <th className="py-2 pr-3 text-right">4 wk</th>
                          <th className="py-2 text-right">Supply</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.segments.map((s) => (
                          <tr key={s.segment} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 pr-3">
                              <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                                <span className="h-2 w-2 rounded-full" style={{ background: SEGMENT_COLORS[s.segment] }} aria-hidden />
                                {s.segment}
                              </span>
                              <div className="text-xs text-muted-foreground">{Math.round(s.weight * 100)}% weight</div>
                            </td>
                            <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">{usd(s.medianSold)}</td>
                            <td className="py-2.5 pr-3 text-right"><Change value={s.change4w} /></td>
                            <td className="py-2.5 text-right text-foreground">{num(s.daysSupply)}<span className="text-xs text-muted-foreground"> d</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </div>

            <Panel title="Metro markets" subtitle="Dealer inventory within 35 miles of each metro center. Price change compares median sold price in the last 30 days with the 30 days before.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Metro</th>
                      <th className="py-2 pr-3 text-right">Active</th>
                      <th className="py-2 pr-3 text-right">Sold 30d</th>
                      <th className="py-2 pr-3 text-right">Median ask</th>
                      <th className="py-2 pr-3 text-right">Median sold</th>
                      <th className="py-2 pr-3 text-right">30d price</th>
                      <th className="py-2 pr-3 text-right">Median DOM</th>
                      <th className="py-2 text-right">Days supply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.metros.map((m) => (
                      <tr key={m.metro} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-3 font-semibold text-foreground">{m.metro}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{num(m.activeCount)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{num(m.sold30d)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{usd(m.medianAsk)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{usd(m.medianSold)}</td>
                        <td className="py-2.5 pr-3 text-right"><Change value={m.priceChange30d} /></td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{num(m.medianDom)}</td>
                        <td className="py-2.5 text-right"><SupplyBadge days={m.daysSupply} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Make velocity" subtitle="Days of supply = active listings ÷ daily exits over the last 30 days. Lower means the make turns faster.">
              <div className="mb-4 inline-flex rounded-lg border border-border bg-muted p-0.5 text-sm" role="tablist">
                {([["volume", "Most listed"], ["fastest", "Fastest turning"], ["slowest", "Slowest turning"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={makeSort === key}
                    onClick={() => setMakeSort(key)}
                    className={`rounded-md px-3 py-1.5 font-semibold transition ${makeSort === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {makes.map((m) => (
                  <div key={m.make} className="grid grid-cols-[7.5rem_1fr_7rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_12rem]" title={`${m.make}: ${num(m.activeCount)} active, ${num(m.sold30d)} sold in 30 days`}>
                    <div className="truncate font-semibold text-foreground">{m.make}</div>
                    <div className="h-3 rounded-sm bg-muted">
                      <div className="h-3 rounded-r" style={{ width: `${((m.daysSupply ?? 0) / maxMakeSupply) * 100}%`, background: INDEX_COLOR }} />
                    </div>
                    <div className="text-right tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{num(m.daysSupply)} d</span>
                      <span className="hidden text-xs sm:inline"> · {num(m.activeCount)} active</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p><strong className="text-foreground">Methodology.</strong> Sales are MarketCheck dealer listings that left the market (sold or delisted) in each Monday–Sunday week. The index is a fixed-weight average of each segment's median sold price relative to its base week, weighted by segment share of sales, so a week with more trucks sold doesn't read as a price rise.</p>
                <p>Segments with fewer than 30 sales in a week carry their previous median. History extends past MarketCheck's 90-day window as daily refreshes accumulate. Asking prices and days on market come from current active inventory.</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
