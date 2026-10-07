import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Gauge,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getAttribution, trackCampaignEvent, withAttribution } from "@/lib/campaign";
import { addCalendarDays, sanAntonioDate } from "@shared/dates";
import { Turnstile } from "@/components/Turnstile";

const CONSENT_VERSION = "lead-contact-v1";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=84";

function money(value?: number | null) {
  return value ? `$${Math.round(value).toLocaleString()}` : "—";
}

export default function VehicleLanding() {
  const [, params] = useRoute("/deals/:make/:model");
  const [, navigate] = useLocation();
  const make = decodeURIComponent(params?.make ?? "");
  const model = decodeURIComponent(params?.model ?? "");
  const listingId = Number(new URLSearchParams(window.location.search).get("listing"));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["landing-deals", make, model],
    queryFn: () => apiRequest("GET", "/api/deals/top?limit=50"),
  });
  const { data: publicConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: () => apiRequest("GET", "/api/public-config"),
    staleTime: 5 * 60 * 1000,
  });
  const deals = useMemo(
    () => (data?.deals ?? []).filter((deal: any) =>
      deal.listing.make.toLowerCase() === make.toLowerCase() &&
      deal.listing.model.toLowerCase() === model.toLowerCase(),
    ).slice(0, 10),
    [data, make, model],
  );
  const [selectedId, setSelectedId] = useState<number | null>(Number.isFinite(listingId) ? listingId : null);
  const selected = deals.find((deal: any) => deal.listing.id === selectedId) ?? deals[0];
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferredDate: "", preferredTimeWindow: "afternoon", consent: false, website: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const minAppointmentDate = sanAntonioDate();
  const maxAppointmentDate = addCalendarDays(minAppointmentDate, 90);

  useEffect(() => {
    if (!selected) return;
    trackCampaignEvent("ViewContent", {
      content_ids: [String(selected.listing.id)],
      content_name: `${selected.listing.year} ${selected.listing.make} ${selected.listing.model}`,
      value: selected.listing.price,
      currency: "USD",
      deal_score: selected.score.dealScore,
    });
  }, [selected?.listing.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.phone.trim() && !form.email.trim()) return setError("Enter a phone number or email address.");
    if (!form.consent) return setError("Consent is required before we can contact you.");
    if (!turnstileToken) return setError("Complete the human verification before submitting.");
    if (!selected) return setError("Choose a vehicle before submitting.");

    setBusy(true);
    const attribution = getAttribution();
    try {
      await apiRequest("POST", "/api/leads", {
        ...form,
        requestId,
        vehicleMake: selected.listing.make,
        vehicleModel: selected.listing.model,
        listingId: selected.listing.id,
        timezone: "America/Chicago",
        consentVersion: CONSENT_VERSION,
        turnstileToken,
        source: "landing_page",
        utmSource: attribution.utm_source,
        utmCampaign: attribution.utm_campaign,
      });
      trackCampaignEvent("Lead", {
        content_ids: [String(selected.listing.id)],
        content_name: `${selected.listing.year} ${selected.listing.make} ${selected.listing.model}`,
        value: selected.listing.price,
        currency: "USD",
      });
      setSent(true);
    } catch {
      setError("We couldn’t send your request. Please try again.");
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
      setBusy(false);
    }
  }

  if (isLoading) return <main className="landing-state"><div className="deal-skeleton" /><div className="deal-skeleton" /></main>;
  if (isError || !selected) return <main className="landing-state"><h1>This shortlist is updating.</h1><p>Return to today’s scored vehicles and choose another deal.</p><a className="button-primary" href={withAttribution("/today#shortlist")}>View today’s shortlist <ArrowRight size={18} /></a></main>;

  const score = selected.score;
  const listing = selected.listing;
  const reasons = score.scoreReasons?.slice(0, 4) ?? [];

  return (
    <div className="landing-shell min-h-[100dvh]">
      <header className="site-header landing-header">
        <button className="back-link" onClick={() => navigate(withAttribution("/today#shortlist"))}><ArrowLeft size={17} /> Today’s shortlist</button>
        <a className="brand-lockup" href="/"><span className="brand-mark">DI</span><span><strong>DealIntel SA</strong><small>Evidence before the test drive</small></span></a>
        <span className="secure-note"><ShieldCheck size={16} /> Secure request</span>
      </header>

      <main className="landing-main">
        <section className="landing-vehicle">
          <div className="landing-eyebrow"><span>#{selected.rank} on today’s shortlist</span><span>San Antonio area</span></div>
          <h1>{listing.year} {listing.make} {listing.model}</h1>
          <p className="landing-trim">{listing.trim || "Local listing"} · {listing.dealerName || "Dealer listing"}</p>

          <div className="landing-image">
            <img src={listing.imageUrls?.[0] || FALLBACK_IMAGE} alt={`${listing.year} ${listing.make} ${listing.model}`} />
            <div className="landing-score"><strong>{Math.round(score.dealScore)}</strong><span>{score.dealScore >= 85 ? "Strong deal" : "Good deal"}</span></div>
          </div>

          <div className="landing-price-row">
            <div><small>Asking price</small><strong>{money(listing.price)}</strong></div>
            <div><small>Estimated market value</small><strong>{money(score.marketValueEst)}</strong></div>
            <div className="price-advantage"><small>Estimated price advantage</small><strong>{money(score.savingsAmount)}</strong></div>
          </div>

          <div className="landing-facts">
            <span><Gauge size={17} /> {listing.mileage?.toLocaleString() ?? "—"} miles</span>
            <span><MapPin size={17} /> {listing.city || "San Antonio"}{listing.distance ? ` · ${listing.distance} miles away` : ""}</span>
            <span><ShieldCheck size={17} /> {score.confidence ? `${Math.round(score.confidence * 100)}% confidence` : "Confidence pending"}{score.compCount ? ` · ${score.compCount} comps` : ""}</span>
          </div>

          <div className="why-panel">
            <p className="eyebrow">Why it scored well</p>
            <ul>{reasons.map((reason: string) => <li key={reason}><Check size={16} /> {reason}</li>)}</ul>
            <p className="fine-print">Estimated market value is not a guaranteed sale or out-the-door price. Confirm the vehicle, current price, taxes, title, registration, and required fees with the dealer.</p>
          </div>

          {deals.length > 1 ? (
            <div className="other-options">
              <div><p className="eyebrow">More {make} {model} options</p><h2>Compare before you request.</h2></div>
              <div className="option-list">
                {deals.slice(0, 4).map((deal: any) => (
                  <button key={deal.listing.id} className={deal.listing.id === listing.id ? "active" : ""} onClick={() => {
                    setSelectedId(deal.listing.id);
                    if (sent) {
                      setBusy(false);
                      setTurnstileToken("");
                      setTurnstileResetKey((value) => value + 1);
                      setRequestId(crypto.randomUUID());
                    }
                    setSent(false);
                  }}>
                    <span>{deal.listing.year} {deal.listing.trim || deal.listing.model}</span><strong>{money(deal.listing.price)}</strong><em>Score {Math.round(deal.score.dealScore)}</em>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="request-panel" id="request">
          <p className="eyebrow">Know before you go</p>
          <h2>Check availability & choose a time</h2>
          <p>Send a preferred test-drive window. The dealer confirms the vehicle, current price, and appointment before you travel.</p>
          {sent ? (
            <div className="success-state" role="status">
              <span><Check size={26} /></span><h3>Request sent.</h3><p>Confirmation is next. Your appointment is not final until the dealer accepts the time.</p><a href={withAttribution("/today#shortlist")}>Keep comparing deals <ArrowRight size={16} /></a>
            </div>
          ) : (
            <form className="request-form" onSubmit={submit}>
              <label><span>Name</span><input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>
              <div className="form-split">
                <label><span>Mobile</span><input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="210 555 0123" /></label>
                <label><span>Email</span><input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
              </div>
              <div className="form-split">
                <label><span>Preferred date</span><input required type="date" min={minAppointmentDate} max={maxAppointmentDate} value={form.preferredDate} onChange={(event) => setForm({ ...form, preferredDate: event.target.value })} /></label>
                <label><span>Time window</span><select value={form.preferredTimeWindow} onChange={(event) => setForm({ ...form, preferredTimeWindow: event.target.value })}><option value="morning">Morning · 9–12</option><option value="midday">Midday · 11–2</option><option value="afternoon">Afternoon · 1–5</option><option value="evening">Evening · 5–7</option></select></label>
              </div>
              <label className="consent-row"><input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>I agree to receive calls, emails, and text messages about this vehicle request from DealIntel SA and its dealership partner. Message and data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase. See the <a href="/privacy">privacy notice</a>.</span></label>
              <input aria-hidden="true" tabIndex={-1} className="honeypot" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
              {typeof publicConfig?.turnstileSiteKey === "string" ? <Turnstile siteKey={publicConfig.turnstileSiteKey} resetKey={turnstileResetKey} onToken={setTurnstileToken} /> : <p role="status" className="fine-print">Loading secure verification…</p>}
              {error ? <p role="alert" className="form-error">{error}</p> : null}
              <button className="button-primary request-submit" type="submit" disabled={busy || !turnstileToken}>{busy ? "Sending request…" : <><CalendarDays size={18} /> Request this test drive</>}</button>
              <small className="fine-print">This sends an appointment request. It does not confirm availability, price, or an appointment.</small>
            </form>
          )}
        </aside>
      </main>
    </div>
  );
}
