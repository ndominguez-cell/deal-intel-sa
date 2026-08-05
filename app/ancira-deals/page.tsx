import Link from "next/link";
import { getLiveAnciraSource, getLiveTopThree } from "@/lib/ancira-live";

function money(value: number | null): string {
  return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function AnciraDealsPage() {
  const vehicles = getLiveTopThree();
  const source = getLiveAnciraSource();

  return (
    <main className="min-h-[100dvh] bg-ink px-4 py-8 text-surface">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber">SA Auto Match · Simulation</p>
        <h1 className="mt-2 text-3xl font-black">Top 3 Ancira deal candidates</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-surface/70">These are the top three candidates ranked from the full South Park Nissan SUV/crossover crawl. They are not being sent as ads. The pages and ads remain a simulation until final availability and pricing checks are complete.</p>
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm text-amber-200"><strong>Full crawl scope:</strong> {source.unique_vehicles} unique vehicles found across {source.pages_crawled} pages; top three selected by the deal engine.</div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {vehicles.map((vehicle, index) => (
            <article key={vehicle.vin} className="overflow-hidden rounded-2xl bg-surface text-ink shadow-card">
              <img src={vehicle.image_url} alt="" className="h-48 w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between"><span className="rounded-full bg-amber px-2 py-1 text-[10px] font-black uppercase">Rank #{index + 1}</span><span className="text-xs font-bold text-ink-600/60">Score {vehicle.deal_score}</span></div>
                <h2 className="mt-3 text-xl font-black">{vehicle.year} {vehicle.make} {vehicle.model}</h2>
                <p className="text-sm text-ink-600/70">{vehicle.trim} · Stock {vehicle.stock_number}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-white p-3"><p className="text-[10px] uppercase text-ink-600/60">MSRP</p><p className="font-black">{money(vehicle.msrp)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[10px] uppercase text-ink-600/60">Ancira price</p><p className="font-black">{money(vehicle.ancira_price)}</p></div></div>
                <p className="mt-3 text-xs text-ink-600/70">MSRP minus displayed price: {money(vehicle.msrp_minus_ancira_price)} · Conditional offers: {vehicle.conditional_offers.length}</p>
                <Link href={`/ancira-deal/${vehicle.stock_number}`} className="mt-5 block rounded-xl bg-ink px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-surface hover:bg-ink-700">Open mock landing page</Link>
              </div>
            </article>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-block text-sm font-bold text-amber underline">Back to generic funnel</Link>
      </div>
    </main>
  );
}
