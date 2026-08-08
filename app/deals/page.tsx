import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency, getRankedMockInventory } from "@/lib/mock-inventory";

export default function DealsPage() {
  if (process.env.ENABLE_INVENTORY_PREVIEWS !== "true") notFound();
  const vehicles = getRankedMockInventory();
  return (
    <main className="min-h-[100dvh] bg-ink px-4 py-8 text-surface">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber">SA Auto Match</p><h1 className="mt-2 text-3xl font-black">Top Ancira deal previews</h1><p className="mt-2 max-w-2xl text-sm text-surface/70">Temporary mock inventory to validate the deal engine, ad routing, and vehicle-specific landing pages while the approved Ancira feed is pending.</p></div>
          <Link href="/" className="rounded-lg border border-surface/20 px-3 py-2 text-sm font-bold hover:border-amber">Generic funnel</Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle, index) => (
            <article key={vehicle.id} className="overflow-hidden rounded-2xl bg-surface text-ink shadow-card">
              <img src={vehicle.imageUrl} alt="" className="h-44 w-full object-cover" />
              <div className="p-5"><div className="flex items-center justify-between"><span className="rounded-full bg-amber px-2 py-1 text-[10px] font-black uppercase">Rank #{index + 1}</span><span className="text-xs font-bold text-ink-600/60">Score {vehicle.score}</span></div><h2 className="mt-3 text-xl font-black">{vehicle.year} {vehicle.make} {vehicle.model}</h2><p className="text-sm text-ink-600/70">{vehicle.trim} · {vehicle.mileage.toLocaleString()} mi</p><p className="mt-3 text-2xl font-black">{formatCurrency(vehicle.price)}</p><p className="mt-2 text-sm text-ink-700/80">{vehicle.reason}</p><Link href={`/deal/${vehicle.id}`} className="mt-5 block rounded-xl bg-ink px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-surface hover:bg-ink-700">Open landing page</Link></div>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-surface/40">MOCK DATA ONLY — do not publish prices, availability, or images as live Ancira offers.</p>
      </div>
    </main>
  );
}
