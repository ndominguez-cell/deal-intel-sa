import { FormEvent, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export default function VehicleLanding() {
  const [, params] = useRoute("/deals/:make/:model");
  const [, navigate] = useLocation();
  const make = decodeURIComponent(params?.make ?? "");
  const model = decodeURIComponent(params?.model ?? "");
  const { data } = useQuery({ queryKey: ["landing-deals", make, model], queryFn: () => apiRequest("GET", "/api/deals/top?limit=50") });
  const deals = useMemo(() => (data?.deals ?? []).filter((d: any) => d.listing.make.toLowerCase() === make.toLowerCase() && d.listing.model.toLowerCase() === model.toLowerCase()).slice(0, 10), [data, make, model]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", website: "" });
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); await apiRequest("POST", "/api/leads", { ...form, vehicleMake: make, vehicleModel: model, source: "landing_page" }); setSent(true); }
  return <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
    <button onClick={() => navigate("/")}>← Back to all deals</button>
    <h1>{make} {model} deals near San Antonio</h1>
    <p>Get notified when a strong local deal appears. Inventory and prices update daily.</p>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
      {deals.map((deal: any) => <article key={deal.listing.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}><h2>{deal.listing.year} {deal.listing.make} {deal.listing.model}</h2><strong>${Number(deal.listing.price).toLocaleString()}</strong><p>{Number(deal.listing.mileage).toLocaleString()} miles · {deal.listing.city}, {deal.listing.state}</p><a href={`/api/listings/${deal.listing.id}`}>View deal details</a></article>)}
    </section>
    <section style={{ maxWidth: 520, marginTop: 32, padding: 20, border: "2px solid #111", borderRadius: 12 }}><h2>Get the next {make} {model} deal</h2>{sent ? <p>Thanks — we’ll follow up when a matching deal is available.</p> : <form onSubmit={submit} style={{ display: "grid", gap: 10 }}><input required placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input aria-hidden="true" tabIndex={-1} style={{ display: "none" }} value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /><button type="submit">I’m interested in this deal</button></form>}</section>
  </main>;
}
