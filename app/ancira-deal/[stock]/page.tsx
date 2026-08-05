import Link from "next/link";
import { notFound } from "next/navigation";
import FunnelShell from "@/components/FunnelShell";
import { getAnciraSampleVehicle, rankAnciraSample } from "@/lib/ancira-sample";

export const dynamicParams = false;

export function generateStaticParams() {
  return rankAnciraSample().map((vehicle) => ({ stock: vehicle.stock_number }));
}

function money(value: number | null): string {
  return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function AnciraDealPage({ params }: { params: { stock: string } }) {
  const vehicle = getAnciraSampleVehicle(params.stock);
  if (!vehicle) notFound();
  const campaign = `ancira-sample-${vehicle.stock_number.toLowerCase()}`;
  const funnelUrl = `/?utm_source=meta&utm_medium=paid_social&utm_campaign=${campaign}&utm_content=${vehicle.stock_number.toLowerCase()}`;

  return (
    <FunnelShell>
      <div className="overflow-hidden rounded-2xl bg-surface text-ink shadow-card">
        <div className="relative h-60 bg-ink"><img src={vehicle.image_url} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" /><div className="absolute left-4 top-4 rounded-full bg-amber px-3 py-1 text-xs font-black uppercase tracking-wide text-ink">Mock ad landing page · sample data</div><div className="absolute bottom-4 left-5 text-surface"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">South Park Nissan · Ancira</p><h1 className="mt-1 text-2xl font-black">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</h1></div></div>
        <div className="px-5 py-6 sm:px-7"><div className="flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-ink-600/60">Displayed Ancira price</p><p className="text-3xl font-black">{money(vehicle.ancira_price)}</p></div><div className="text-right"><p className="text-xs uppercase tracking-wide text-ink-600/60">Engine score</p><p className="text-xl font-black">{vehicle.deal_score}</p></div></div><p className="mt-4 text-sm leading-relaxed text-ink-700/80">A vehicle-specific preview built from the supplied inventory extraction. A specialist can confirm current availability, pricing, eligibility, and comparable options.</p><div className="mt-5 rounded-xl border border-surface-line bg-white p-4 text-sm"><p><strong>MSRP:</strong> {money(vehicle.msrp)}</p><p className="mt-1"><strong>MSRP minus displayed price:</strong> {money(vehicle.msrp_minus_ancira_price)}</p><p className="mt-1"><strong>Stock:</strong> {vehicle.stock_number}</p><p className="mt-1"><strong>VIN:</strong> {vehicle.vin}</p></div><p className="mt-4 rounded-lg bg-amber/15 px-3 py-2 text-xs leading-relaxed text-amber-700">Conditional offers may have eligibility restrictions. Advertised pricing excludes tax, title, license, VIT tax, $225 doc fee, and $10 deputy fee. Verify before publishing.</p><Link href={funnelUrl} className="mt-6 flex w-full items-center justify-center rounded-xl bg-amber px-5 py-4 text-base font-extrabold uppercase tracking-wide text-ink shadow-amber hover:bg-amber-400">Check this vehicle match</Link><a href={vehicle.source_url} target="_blank" rel="noreferrer" className="mt-4 block text-center text-xs font-semibold text-ink-600/70 underline">View source inventory page</a></div>
      </div>
    </FunnelShell>
  );
}
