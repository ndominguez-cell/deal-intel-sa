import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { trackCampaignEvent, withAttribution } from "@/lib/campaign";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=82";

type Deal = {
  rank: number;
  listing: {
    id: number;
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    price?: number | null;
    mileage?: number | null;
    city?: string | null;
    state?: string | null;
    distance?: number | null;
    dealerName?: string | null;
    titleStatus?: string | null;
    imageUrls?: string[] | null;
    lastSeenAt?: string | null;
  };
  score: {
    dealScore: number;
    marketValueEst?: number | null;
    compCount?: number | null;
    confidence?: number | null;
    savingsAmount?: number | null;
    scoreBreakdown?: Record<string, number> | null;
    scoreReasons?: string[] | null;
    velocityPrediction?: number | null;
  };
};

const scoreParts = [
  ["priceAdvantage", "Price vs market", 40],
  ["mileageAdvantage", "Mileage", 15],
  ["localDemand", "Local demand", 15],
  ["reliability", "Reliability", 10],
  ["sellerQuality", "Seller quality", 10],
  ["priceDropSignal", "Price history", 10],
] as const;

function money(value?: number | null) {
  return value ? `$${Math.round(value).toLocaleString()}` : "—";
}

function scoreLabel(score: number) {
  if (score >= 85) return "Strong deal";
  if (score >= 70) return "Good deal";
  if (score >= 50) return "Fair value";
  return "Watchlist";
}

function dealPath(deal: Deal) {
  const { listing } = deal;
  const base = `/deals/${encodeURIComponent(listing.make)}/${encodeURIComponent(listing.model)}`;
  const url = new URL(base, window.location.origin);
  url.searchParams.set("listing", String(listing.id));
  return withAttribution(`${url.pathname}${url.search}`);
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "strong" | "fast">("strong");
  const [sort, setSort] = useState<"score" | "savings" | "mileage">("score");
  const [visibleCount, setVisibleCount] = useState(12);

  const statsQuery = useQuery({
    queryKey: ["/api/stats/overview"],
    queryFn: () => apiRequest("GET", "/api/stats/overview"),
    refetchInterval: 30_000,
  });
  const dealsQuery = useQuery({
    queryKey: ["/api/deals/top", 50],
    queryFn: () => apiRequest("GET", "/api/deals/top?min_score=0&limit=50"),
    refetchInterval: 30_000,
  });

  const deals: Deal[] = dealsQuery.data?.deals ?? [];
  const stats = statsQuery.data;
  const featured = useMemo(() => {
    const query = search.trim().toLowerCase();
    return deals
      .filter((deal) => {
        const listing = deal.listing;
        const matchesQuery =
          !query ||
          `${listing.year} ${listing.make} ${listing.model} ${listing.trim ?? ""} ${listing.dealerName ?? ""}`
            .toLowerCase()
            .includes(query);
        const matchesFilter =
          filter === "all" ||
          (filter === "strong" && deal.score.dealScore >= 85) ||
          (filter === "fast" && (deal.score.velocityPrediction ?? 0) >= 70);
        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => {
        if (sort === "savings") return (b.score.savingsAmount ?? 0) - (a.score.savingsAmount ?? 0);
        if (sort === "mileage") return (a.listing.mileage ?? Infinity) - (b.listing.mileage ?? Infinity);
        return b.score.dealScore - a.score.dealScore;
      });
  }, [deals, filter, search, sort]);

  const leadDeal = deals[0];
  const scrollToShortlist = () => {
    document.getElementById("shortlist")?.scrollIntoView({ behavior: "smooth" });
    trackCampaignEvent("Search", { content_category: "daily_shortlist" });
  };

  return (
    <div className="site-shell min-h-[100dvh] bg-background text-foreground">
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="DealIntel SA home">
          <span className="brand-mark">DI</span>
          <span><strong>DealIntel SA</strong><small>San Antonio vehicle intelligence</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#shortlist">Today’s shortlist</a>
          <a href="#method">How scores work</a>
          <span className="market-status"><i /> Market engine online</span>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy reveal-up">
            <p className="eyebrow"><Sparkles size={14} /> Updated from licensed market data</p>
            <h1>Stop hunting.<br />Start with the cars that <em>earned attention.</em></h1>
            <p className="hero-lede">
              We rank San Antonio vehicles by price versus estimated market value,
              mileage, local demand, reliability, seller quality, and price history.
              Every score shows its work.
            </p>
            <div className="hero-actions">
              <button className="button-primary" onClick={scrollToShortlist}>
                See today’s scored deals <ArrowRight size={18} />
              </button>
              <a className="button-quiet" href="#method">See the scoring method</a>
            </div>
            <div className="trust-line">
              <span><ShieldCheck size={16} /> No purchase obligation</span>
              <span><Clock3 size={16} /> Daily inventory sync</span>
              <span><MapPin size={16} /> San Antonio area</span>
            </div>
          </div>

          <div className="hero-proof reveal-up delay-1" aria-label="Top deal preview">
            <div className="proof-header"><span>Today’s #1 ranked deal</span><span className="live-chip"><i /> Live shortlist</span></div>
            {leadDeal ? (
              <>
                <div className="proof-vehicle">
                  <img src={leadDeal.listing.imageUrls?.[0] || FALLBACK_IMAGE} alt={`${leadDeal.listing.year} ${leadDeal.listing.make} ${leadDeal.listing.model}`} />
                  <div className="score-orbit"><strong>{Math.round(leadDeal.score.dealScore)}</strong><span>{scoreLabel(leadDeal.score.dealScore)}</span></div>
                </div>
                <div className="proof-name"><span>{leadDeal.listing.year}</span><h2>{leadDeal.listing.make} {leadDeal.listing.model}</h2><p>{leadDeal.listing.trim || "Local listing"}</p></div>
                <div className="proof-numbers">
                  <div><small>Asking price</small><strong>{money(leadDeal.listing.price)}</strong></div>
                  <div><small>Est. market value</small><strong>{money(leadDeal.score.marketValueEst)}</strong></div>
                  <div className="accent-number"><small>Est. price advantage</small><strong>{money(leadDeal.score.savingsAmount)}</strong></div>
                </div>
                <a className="proof-link" href={dealPath(leadDeal)} onClick={() => trackCampaignEvent("SelectDeal", { listing_id: leadDeal.listing.id, deal_score: leadDeal.score.dealScore })}>
                  Check this vehicle <ArrowRight size={17} />
                </a>
              </>
            ) : <div className="proof-loading">Scoring today’s inventory…</div>}
          </div>
        </section>

        <section className="market-strip" aria-label="Live market summary">
          <div><small>Listings analyzed</small><strong>{stats?.totalListings?.toLocaleString() ?? "—"}</strong></div>
          <div><small>Strong deals today</small><strong>{stats?.belowMarketToday ?? "—"}</strong></div>
          <div><small>Price signals · 24h</small><strong>{stats?.priceDrops24h ?? "—"}</strong></div>
          <div><small>Market coverage</small><strong>45 mi</strong></div>
        </section>

        <section className="shortlist-section" id="shortlist">
          <div className="section-heading">
            <div><p className="eyebrow">The daily shortlist</p><h2>Compare the evidence.<br />Choose only what adds up.</h2></div>
            <p>Estimated market value is a decision aid, not a guaranteed sale price. Open any score to see its strongest reasons and comparison confidence.</p>
          </div>

          <div className="filter-rail">
            <label className="search-box"><Search size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search make, model, trim, or dealer" aria-label="Search scored vehicles" /></label>
            <div className="segmented-control" aria-label="Deal filters">
              {(["strong", "all", "fast"] as const).map((value) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => { setFilter(value); setVisibleCount(12); }}>
                  {value === "strong" ? "Strong deals" : value === "all" ? "All scored" : "Fast sellers"}
                </button>
              ))}
            </div>
            <label className="sort-select"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="score">Deal Score</option><option value="savings">Price advantage</option><option value="mileage">Lowest mileage</option></select><ChevronDown size={15} /></label>
          </div>

          {dealsQuery.isLoading ? (
            <div className="deal-grid" aria-label="Loading scored vehicles">{Array.from({ length: 6 }).map((_, index) => <div className="deal-skeleton" key={index} />)}</div>
          ) : dealsQuery.isError ? (
            <div className="state-panel"><h3>The shortlist could not load.</h3><p>Please refresh the page. The scoring engine may be completing its daily update.</p></div>
          ) : featured.length ? (
            <><div className="deal-grid">{featured.slice(0, visibleCount).map((deal) => <DealCard key={deal.listing.id} deal={deal} />)}</div>{visibleCount < featured.length ? <button className="load-more" onClick={() => setVisibleCount((count) => count + 12)}>Show more scored vehicles <ArrowRight size={17} /></button> : null}</>
          ) : <div className="state-panel"><h3>No vehicles match those filters.</h3><p>Try another make or switch to “All scored.”</p></div>}
        </section>

        <section className="method-section" id="method">
          <div className="method-intro"><p className="eyebrow">Transparent by design</p><h2>A score should shorten the search—not hide the facts.</h2><p>Deal Score compresses six signals into a first pass. The market estimate, comparison count, confidence, title status, and score reasons stay visible so you can make your own call.</p></div>
          <ol className="method-list">
            <li><span>01</span><div><strong>Price advantage</strong><p>Up to 40 points from asking price versus local comparable inventory.</p></div></li>
            <li><span>02</span><div><strong>Vehicle context</strong><p>Mileage, reliability, and title signals adjust the quality of the opportunity.</p></div></li>
            <li><span>03</span><div><strong>Local movement</strong><p>San Antonio demand and price-drop history reveal momentum without fake countdowns.</p></div></li>
            <li><span>04</span><div><strong>Confidence</strong><p>Comparison count shows how much market evidence supports the estimate.</p></div></li>
          </ol>
        </section>

        <section className="closing-cta">
          <div><p className="eyebrow">Know before you go</p><h2>Found a car worth seeing?</h2><p>Request availability and a preferred test-drive window. The dealer confirms the vehicle and time before you make the trip.</p></div>
          <button className="button-primary" onClick={scrollToShortlist}>Choose a scored vehicle <ArrowRight size={18} /></button>
        </section>
      </main>

      <footer>
        <div className="brand-lockup"><span className="brand-mark">DI</span><span><strong>DealIntel SA</strong><small>Evidence before the test drive.</small></span></div>
        <p>Estimated market values are informational. Taxes, title, registration, and dealer-required charges may affect the out-the-door price.</p>
        <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const { listing, score } = deal;
  const [open, setOpen] = useState(false);
  const reasons = score.scoreReasons?.slice(0, 3) ?? [];
  const path = dealPath(deal);

  return (
    <article className="deal-card">
      <div className="deal-image-wrap">
        <img src={listing.imageUrls?.[0] || FALLBACK_IMAGE} alt={`${listing.year} ${listing.make} ${listing.model}`} loading="lazy" />
        <div className="rank-chip">#{deal.rank} today</div>
        <div className="card-score"><strong>{Math.round(score.dealScore)}</strong><span>{scoreLabel(score.dealScore)}</span></div>
      </div>
      <div className="deal-body">
        <div className="deal-title-row"><div><small>{listing.year} · {listing.trim || "Local listing"}</small><h3>{listing.make} {listing.model}</h3></div><div className="deal-price"><strong>{money(listing.price)}</strong><small>asking price</small></div></div>
        <div className="deal-facts"><span><Gauge size={15} /> {listing.mileage?.toLocaleString() ?? "—"} mi</span><span><MapPin size={15} /> {listing.city || "San Antonio"}{listing.distance ? ` · ${listing.distance} mi` : ""}</span></div>
        <div className="value-band">
          <div><small>Estimated market</small><strong>{money(score.marketValueEst)}</strong></div>
          <div><small>Est. price advantage</small><strong>{money(score.savingsAmount)}</strong></div>
          <div><small>Confidence</small><strong>{score.confidence ? `${Math.round(score.confidence * 100)}%` : "—"}</strong><em>{score.compCount ? `${score.compCount} comps` : "limited comps"}</em></div>
        </div>
        {reasons.length ? <ul className="reason-list">{reasons.map((reason) => <li key={reason}><Check size={14} /> {reason}</li>)}</ul> : null}
        <div className="card-actions">
          <button className="evidence-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Hide" : "Show"} score breakdown <ChevronDown size={15} className={open ? "rotate" : ""} /></button>
          <a href={path} className="availability-link" onClick={() => trackCampaignEvent("StartAvailabilityRequest", { listing_id: listing.id, deal_score: score.dealScore })}>Check availability <ArrowRight size={16} /></a>
        </div>
        {open ? (
          <div className="score-breakdown">
            {scoreParts.map(([key, label, max]) => { const value = score.scoreBreakdown?.[key] ?? 0; return <div key={key}><span>{label}</span><i><b style={{ width: `${Math.min(100, value / max * 100)}%` }} /></i><strong>+{value}</strong></div>; })}
            <p><BarChart3 size={14} /> Estimated values are based on comparable active inventory and can change as listings update.</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
