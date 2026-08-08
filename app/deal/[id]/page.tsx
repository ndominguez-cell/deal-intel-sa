import Link from "next/link";
import { notFound } from "next/navigation";
import FunnelShell from "@/components/FunnelShell";
import { formatCurrency, getMockVehicle, MOCK_ANCIRA_INVENTORY } from "@/lib/mock-inventory";

export const dynamicParams = false;

export function generateStaticParams() {
  if (process.env.ENABLE_INVENTORY_PREVIEWS !== "true") return [];
  return MOCK_ANCIRA_INVENTORY.map((vehicle) => ({ id: vehicle.id }));
}

export default async function DealPage({ params }: { params: { id: string } }) {
  if (process.env.ENABLE_INVENTORY_PREVIEWS !== "true") notFound();
  const vehicle = getMockVehicle(params.id);
  if (!vehicle) notFound();

  const funnelUrl = `/?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=${vehicle.id}`;

  return (
    <FunnelShell>
      <div className="overflow-hidden rounded-2xl bg-surface text-ink shadow-card">
        <div className="relative h-56 bg-ink">
          <img src={vehicle.imageUrl} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-amber px-3 py-1 text-xs font-black uppercase tracking-wide text-ink">Mock deal preview</div>
          <div className="absolute bottom-4 left-5 text-surface">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">{vehicle.dealer} inventory</p>
            <h1 className="mt-1 text-2xl font-black">{vehicle.year} {vehicle.make} {vehicle.model}</h1>
          </div>
        </div>
        <div className="px-5 py-6 sm:px-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-600/70">{vehicle.trim} · {vehicle.category} · {vehicle.condition}</p>
          <p className="mt-3 text-lg font-bold">{vehicle.headline}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-surface-line bg-white p-3"><p className="text-xs uppercase text-ink-600/60">Price</p><p className="mt-1 text-xl font-black">{formatCurrency(vehicle.price)}</p></div>
            <div className="rounded-xl border border-surface-line bg-white p-3"><p className="text-xs uppercase text-ink-600/60">Mileage</p><p className="mt-1 text-xl font-black">{vehicle.mileage.toLocaleString()}</p></div>
          </div>
          {vehicle.priceDrop ? <p className="mt-4 rounded-lg bg-amber/15 px-3 py-2 text-sm font-bold text-amber-700">Mock price movement: {formatCurrency(vehicle.priceDrop)} recently reduced</p> : null}
          <p className="mt-4 text-sm leading-relaxed text-ink-700/80">{vehicle.reason} Tell us what you are looking for and a vehicle specialist can confirm current availability and match options.</p>
          <Link href={funnelUrl} className="mt-6 flex w-full items-center justify-center rounded-xl bg-amber px-5 py-4 text-center text-base font-extrabold uppercase tracking-wide text-ink shadow-amber hover:bg-amber-400">Check this match</Link>
          <p className="mt-3 text-center text-xs text-ink-600/60">Mock inventory for testing only. Final pricing, availability, and vehicle details must be confirmed with Ancira.</p>
        </div>
      </div>
    </FunnelShell>
  );
}
