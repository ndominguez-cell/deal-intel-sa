"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FunnelShell from "@/components/FunnelShell";
import ProgressBar from "@/components/ProgressBar";
import StepCard from "@/components/StepCard";
import OptionGrid from "@/components/OptionGrid";
import TextField from "@/components/TextField";
import PrimaryButton from "@/components/PrimaryButton";
import BackButton from "@/components/BackButton";
import { captureUtmParams, getUtmParams } from "@/lib/utm";

const DRAFT_KEY = "sa_auto_match_draft";

type Answers = {
  vehicle_type: string;
  has_trade_in: "" | "yes" | "no";
  trade_year: string;
  trade_make: string;
  trade_model: string;
  trade_mileage: string;
  payment_target: string;
  down_payment: string;
  credit_band: string;
  timeframe: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
  company: string; // honeypot
};

const EMPTY: Answers = {
  vehicle_type: "",
  has_trade_in: "",
  trade_year: "",
  trade_make: "",
  trade_model: "",
  trade_mileage: "",
  payment_target: "",
  down_payment: "",
  credit_band: "",
  timeframe: "",
  name: "",
  phone: "",
  email: "",
  consent: false,
  company: "",
};

type StepId =
  | "vehicle"
  | "trade"
  | "tradeDetails"
  | "payment"
  | "down"
  | "credit"
  | "timeframe"
  | "contact";

const VEHICLE_OPTS = [
  { value: "Truck", label: "Truck" },
  { value: "SUV", label: "SUV" },
  { value: "Sedan", label: "Sedan" },
  { value: "Van", label: "Van" },
  { value: "Other", label: "Other" },
];
const TRADE_OPTS = [
  { value: "yes", label: "Yes, I have a trade-in" },
  { value: "no", label: "No trade-in" },
];
const PAYMENT_OPTS = [
  { value: "<$300", label: "Under $300" },
  { value: "$300-400", label: "$300 – $400" },
  { value: "$400-500", label: "$400 – $500" },
  { value: "$500+", label: "$500+" },
];
const DOWN_OPTS = [
  { value: "$0", label: "$0" },
  { value: "<$2k", label: "Under $2,000" },
  { value: "$2-5k", label: "$2,000 – $5,000" },
  { value: "$5k+", label: "$5,000+" },
];
const CREDIT_OPTS = [
  { value: "Excellent", label: "Excellent" },
  { value: "Good", label: "Good" },
  { value: "Fair", label: "Fair" },
  { value: "Rebuilding", label: "Rebuilding" },
];
const TIMEFRAME_OPTS = [
  { value: "This week", label: "This week" },
  { value: "This month", label: "This month" },
  { value: "Just browsing", label: "Just browsing" },
];

export default function FunnelPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture attribution + rehydrate any saved draft on mount.
  useEffect(() => {
    captureUtmParams();
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Answers>;
        setAnswers((prev) => ({ ...prev, ...saved }));
      }
    } catch {
      /* ignore corrupt draft */
    }
    hydrated.current = true;
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Persist a draft on every answer change (after hydration).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch {
      /* storage unavailable; ignore */
    }
  }, [answers]);

  // The step list is dynamic: the trade-details step only exists when the
  // user says they have a trade-in.
  const steps: StepId[] = [
    "vehicle",
    "trade",
    ...(answers.has_trade_in === "yes" ? (["tradeDetails"] as StepId[]) : []),
    "payment",
    "down",
    "credit",
    "timeframe",
    "contact",
  ];

  // Clamp the index if the step list shrank (e.g. flipped trade-in to No).
  useEffect(() => {
    if (stepIndex > steps.length - 1) {
      setStepIndex(steps.length - 1);
    }
  }, [steps.length, stepIndex]);

  const current = steps[Math.min(stepIndex, steps.length - 1)];

  const set = useCallback(<K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const goBack = useCallback(() => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Select a value on a tap-only step, then auto-advance after a short beat
  // so the selection is visible before the transition.
  const selectAndAdvance = useCallback(
    <K extends keyof Answers>(key: K, value: Answers[K]) => {
      set(key, value);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setStepIndex((i) => {
          // recompute length with the new trade-in answer if relevant
          const willHaveTrade =
            key === "has_trade_in" ? value === "yes" : answers.has_trade_in === "yes";
          const len = 7 + (willHaveTrade ? 1 : 0);
          return Math.min(i + 1, len - 1);
        });
      }, 140);
    },
    [set, answers.has_trade_in]
  );

  const canSubmit =
    answers.name.trim().length > 0 &&
    answers.phone.trim().length > 0 &&
    answers.consent === true &&
    !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const hasTrade = answers.has_trade_in === "yes";
    const utm = getUtmParams();

    const payload = {
      name: answers.name.trim(),
      phone: answers.phone.trim(),
      email: answers.email.trim(),
      vehicle_type: answers.vehicle_type,
      has_trade_in: hasTrade,
      trade_year: hasTrade ? answers.trade_year.trim() : "",
      trade_make: hasTrade ? answers.trade_make.trim() : "",
      trade_model: hasTrade ? answers.trade_model.trim() : "",
      trade_mileage: hasTrade ? answers.trade_mileage.trim() : "",
      payment_target: answers.payment_target,
      down_payment: answers.down_payment,
      credit_band: answers.credit_band,
      timeframe: answers.timeframe,
      consent: answers.consent,
      source: "sa-auto-match",
      company: answers.company, // honeypot — real users leave this blank
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        router.push("/thanks");
        return;
      }
      setError("Something went wrong — your info is saved, tap to try again.");
    } catch {
      setError("Network hiccup — your info is saved, tap to try again.");
    } finally {
      setSubmitting(false);
    }
  }, [answers, canSubmit, router]);

  const showBack = stepIndex > 0 && !submitting;

  return (
    <FunnelShell>
      <div className="mb-4">
        <Link href="/deals" className="mb-3 block rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-center text-xs font-bold text-amber-400 hover:bg-amber/20">
          Browse mock Ancira deal previews →
        </Link>
        <ProgressBar current={stepIndex + 1} total={steps.length} />
      </div>

      {current === "vehicle" && (
        <StepCard
          title="What are you shopping for?"
          subtitle="Pick the type of vehicle you want next."
        >
          <OptionGrid
            columns={2}
            options={VEHICLE_OPTS}
            value={answers.vehicle_type}
            onSelect={(v) => selectAndAdvance("vehicle_type", v)}
          />
        </StepCard>
      )}

      {current === "trade" && (
        <StepCard
          title="Do you have a trade-in?"
          subtitle="A trade can boost your buying power."
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <OptionGrid
            options={TRADE_OPTS}
            value={answers.has_trade_in}
            onSelect={(v) => selectAndAdvance("has_trade_in", v as Answers["has_trade_in"])}
          />
        </StepCard>
      )}

      {current === "tradeDetails" && (
        <StepCard
          title="Tell us about your trade"
          subtitle="Rough details are fine — we'll confirm later."
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <div className="space-y-3">
            <TextField
              label="Year"
              name="trade_year"
              inputMode="numeric"
              placeholder="e.g. 2018"
              value={answers.trade_year}
              onChange={(e) => set("trade_year", e.target.value)}
            />
            <TextField
              label="Make"
              name="trade_make"
              placeholder="e.g. Toyota"
              value={answers.trade_make}
              onChange={(e) => set("trade_make", e.target.value)}
            />
            <TextField
              label="Model"
              name="trade_model"
              placeholder="e.g. Camry"
              value={answers.trade_model}
              onChange={(e) => set("trade_model", e.target.value)}
            />
            <TextField
              label="Approx. mileage"
              name="trade_mileage"
              inputMode="numeric"
              placeholder="e.g. 72,000"
              value={answers.trade_mileage}
              onChange={(e) => set("trade_mileage", e.target.value)}
            />
            <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
          </div>
        </StepCard>
      )}

      {current === "payment" && (
        <StepCard
          title="Target monthly payment?"
          subtitle="What feels comfortable for you each month."
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <OptionGrid
            columns={2}
            options={PAYMENT_OPTS}
            value={answers.payment_target}
            onSelect={(v) => selectAndAdvance("payment_target", v)}
          />
        </StepCard>
      )}

      {current === "down" && (
        <StepCard
          title="Down payment available?"
          subtitle="Cash down, not counting your trade."
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <OptionGrid
            columns={2}
            options={DOWN_OPTS}
            value={answers.down_payment}
            onSelect={(v) => selectAndAdvance("down_payment", v)}
          />
        </StepCard>
      )}

      {current === "credit" && (
        <StepCard
          title="How would you rate your credit?"
          subtitle="Your best guess — no check, no impact."
          helper="This won't affect your credit — it's just a self-estimate."
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <OptionGrid
            columns={2}
            options={CREDIT_OPTS}
            value={answers.credit_band}
            onSelect={(v) => selectAndAdvance("credit_band", v)}
          />
        </StepCard>
      )}

      {current === "timeframe" && (
        <StepCard
          title="When are you looking to buy?"
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <OptionGrid
            options={TIMEFRAME_OPTS}
            value={answers.timeframe}
            onSelect={(v) => selectAndAdvance("timeframe", v)}
          />
        </StepCard>
      )}

      {current === "contact" && (
        <StepCard
          title="Where should we send your matches?"
          subtitle="A specialist will reach out with real options."
          footer={showBack ? <BackButton onClick={goBack} /> : undefined}
        >
          <div className="space-y-3">
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              placeholder="First and last"
              value={answers.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <TextField
              label="Mobile phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={answers.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            <TextField
              label="Email (optional)"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={answers.email}
              onChange={(e) => set("email", e.target.value)}
            />

            {/* Honeypot — hidden from humans, catches bots. */}
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={answers.company}
              onChange={(e) => set("company", e.target.value)}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-surface-line bg-white p-3 text-left">
              <input
                type="checkbox"
                checked={answers.consent}
                onChange={(e) => set("consent", e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-amber"
              />
              <span className="text-xs leading-relaxed text-ink-700/80">
                By checking this box, I agree that SA Auto Match and the
                participating dealership may contact me at the phone number and
                email I provided — including by phone call and text message,
                using automated technology or prerecorded messages — about
                vehicles and my request. Consent is not a condition of any
                purchase. Message and data rates may apply; reply STOP to opt
                out.
              </span>
            </label>

            {error ? (
              <p className="text-center text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}

            <PrimaryButton
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            >
              {error ? "Try Again" : "Get My Matches"}
            </PrimaryButton>
          </div>
        </StepCard>
      )}
    </FunnelShell>
  );
}
