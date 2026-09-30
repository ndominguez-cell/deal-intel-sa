import { FormEvent, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { addCalendarDays, sanAntonioDate } from "@shared/dates";
import { Turnstile } from "@/components/Turnstile";

const CONSENT_VERSION = "lead-contact-v1";

export default function VehicleLanding() {
  const [, params] = useRoute("/deals/:make/:model");
  const [, navigate] = useLocation();
  const make = decodeURIComponent(params?.make ?? "");
  const model = decodeURIComponent(params?.model ?? "");
  const { data } = useQuery({
    queryKey: ["landing-deals", make, model],
    queryFn: () => apiRequest("GET", "/api/deals/top?limit=50"),
  });
  const { data: publicConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: () => apiRequest("GET", "/api/public-config"),
    staleTime: 5 * 60 * 1000,
  });
  const deals = useMemo(
    () =>
      (data?.deals ?? [])
        .filter(
          (deal: any) =>
            deal.listing.make.toLowerCase() === make.toLowerCase() &&
            deal.listing.model.toLowerCase() === model.toLowerCase(),
        )
        .slice(0, 10),
    [data, make, model],
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    preferredDate: "",
    preferredTimeWindow: "afternoon",
    consent: false,
    website: "",
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const minAppointmentDate = sanAntonioDate();
  const maxAppointmentDate = addCalendarDays(minAppointmentDate, 90);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Enter a phone number or email address.");
      return;
    }
    if (!form.consent) {
      setError("Consent is required before we can contact you.");
      return;
    }
    if (!turnstileToken) {
      setError("Complete the human verification before submitting.");
      return;
    }

    setBusy(true);
    try {
      await apiRequest("POST", "/api/leads", {
        ...form,
        requestId,
        vehicleMake: make,
        vehicleModel: model,
        timezone: "America/Chicago",
        consentVersion: CONSENT_VERSION,
        turnstileToken,
        source: "landing_page",
      });
      setSent(true);
    } catch {
      setError("We couldn't send your request. Please try again.");
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <button onClick={() => navigate("/")}>← Back to all deals</button>
      <h1>Skip the hunt. Start with today’s best-scored cars.</h1>
      <p>
        Review scored {make} {model} listings near San Antonio, then request a
        preferred time to check availability with a dealer.
      </p>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 16,
        }}
      >
        {deals.map((deal: any) => (
          <article
            key={deal.listing.id}
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}
          >
            <h2>
              {deal.listing.year} {deal.listing.make} {deal.listing.model}
            </h2>
            <strong>${Number(deal.listing.price).toLocaleString()}</strong>
            <p>
              {Number(deal.listing.mileage).toLocaleString()} miles ·{" "}
              {deal.listing.city}, {deal.listing.state}
            </p>
            <a href={`/api/listings/${deal.listing.id}`}>View deal details</a>
          </article>
        ))}
      </section>
      <section
        style={{
          maxWidth: 560,
          marginTop: 32,
          padding: 20,
          border: "2px solid #111",
          borderRadius: 12,
        }}
      >
        <h2>Check availability &amp; choose a time</h2>
        {sent ? (
          <div role="status">
            <h3>Request received</h3>
            <p>
              We sent your preferred window to the team. Your appointment is
              not confirmed until a dealer contacts you and accepts the time.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <label>
              Name
              <input
                required
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              Preferred date
              <input
                required
                type="date"
                min={minAppointmentDate}
                max={maxAppointmentDate}
                value={form.preferredDate}
                onChange={(event) =>
                  setForm({ ...form, preferredDate: event.target.value })
                }
              />
            </label>
            <label>
              Preferred time window
              <select
                value={form.preferredTimeWindow}
                onChange={(event) =>
                  setForm({ ...form, preferredTimeWindow: event.target.value })
                }
              >
                <option value="morning">Morning (9 AM–12 PM)</option>
                <option value="midday">Midday (11 AM–2 PM)</option>
                <option value="afternoon">Afternoon (1–5 PM)</option>
                <option value="evening">Evening (5–7 PM)</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) =>
                  setForm({ ...form, consent: event.target.checked })
                }
              />
              <span>
                I agree to receive calls, emails, and text messages about this
                vehicle request from DealIntelSA and its dealership partner.
                Message and data rates may apply. Reply STOP to opt out. Consent
                is not a condition of purchase. See our <a href="/privacy">privacy notice</a>.
              </span>
            </label>
            <input
              aria-hidden="true"
              tabIndex={-1}
              style={{ display: "none" }}
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
            />
            {typeof publicConfig?.turnstileSiteKey === "string" ? (
              <Turnstile
                siteKey={publicConfig.turnstileSiteKey}
                resetKey={turnstileResetKey}
                onToken={setTurnstileToken}
              />
            ) : (
              <p role="status">Loading secure verification…</p>
            )}
            {error ? <p role="alert">{error}</p> : null}
            <button type="submit" disabled={busy || !turnstileToken}>
              {busy ? "Sending request…" : "Check availability & choose a time"}
            </button>
            <small>
              This submits an appointment request. It does not confirm vehicle
              availability or an appointment.
            </small>
          </form>
        )}
      </section>
    </main>
  );
}
