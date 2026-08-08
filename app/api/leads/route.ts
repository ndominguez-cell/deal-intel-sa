// SA Auto Match — lead capture endpoint.
//
// POST flow (order matters):
//   (a) parse + validate body; honeypot, rate-limit, idempotency, enum, length,
//       and consent checks -> 400/429 on failure.
//   (b) insert into Supabase `auto_leads` FIRST. If this fails, return 500;
//       the lead has not been dispatched anywhere else, so nothing is lost.
//   (c) createLeadTask (ClickUp) + sendLeadAlert (Resend), with bounded network
//       calls; ClickUp failures are recorded as FOLLOW_UP_ERROR.
//   (d) return 200 { ok: true }.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createLeadTask } from "@/lib/clickup";
import { sendLeadAlert } from "@/lib/resend";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;
const requestsByIp = new Map<string, number[]>();
const seenSubmissionIds = new Map<string, number>();

const VEHICLE_TYPES = new Set(["Truck", "SUV", "Sedan", "Van", "Other"]);
const APPOINTMENT_TIMES = new Set([
  "Today",
  "Tomorrow",
  "This week",
  "Just exploring",
]);
const CONTACT_WINDOWS = new Set(["Morning", "Afternoon", "Evening", "Anytime"]);

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v.trim() : String(v).trim();
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1" || s === "on";
  }
  return false;
}

function isBooleanInput(v: unknown): boolean {
  if (typeof v === "boolean") return true;
  if (typeof v !== "string") return false;
  return ["true", "false", "yes", "no", "1", "0", "on", "off"].includes(
    v.trim().toLowerCase()
  );
}

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  return (forwarded || real || "unknown").slice(0, 100);
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
  const key = clientKey(req);
  const recent = (requestsByIp.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestsByIp.set(key, recent);
    return true;
  }
  recent.push(now);
  requestsByIp.set(key, recent);
  return false;
}

function isDuplicateSubmission(submissionId: string): boolean {
  const now = Date.now();
  for (const [id, timestamp] of seenSubmissionIds) {
    if (now - timestamp >= IDEMPOTENCY_WINDOW_MS) seenSubmissionIds.delete(id);
  }
  if (seenSubmissionIds.has(submissionId)) return true;
  seenSubmissionIds.set(submissionId, now);
  return false;
}

function releaseSubmission(submissionId: string): void {
  seenSubmissionIds.delete(submissionId);
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function validateLead(raw: Record<string, unknown>, lead: Lead): string[] {
  const errors: string[] = [];
  const required = ["name", "phone", "vehicle_type", "timeframe", "submission_id"];
  for (const field of required) {
    if (!str(raw[field])) errors.push(field);
  }
  if (!Object.prototype.hasOwnProperty.call(raw, "has_trade_in")) {
    errors.push("has_trade_in");
  } else if (!isBooleanInput(raw.has_trade_in)) {
    errors.push("has_trade_in");
  }
  if (
    lead.name.length > 100 ||
    hasControlCharacters(lead.name) ||
    !/^[\p{L} .'-]+$/u.test(lead.name)
  ) {
    errors.push("name");
  }
  if (
    lead.phone.length > 30 ||
    hasControlCharacters(lead.phone) ||
    !/^[0-9+().\-\s]+$/.test(lead.phone) ||
    lead.phone.replace(/\D/g, "").length < 10
  ) {
    errors.push("phone");
  }
  if (lead.email.length > 254 || (lead.email && !/^\S+@\S+\.\S+$/.test(lead.email))) {
    errors.push("email");
  }
  if (!VEHICLE_TYPES.has(lead.vehicle_type)) errors.push("vehicle_type");
  if (!APPOINTMENT_TIMES.has(lead.timeframe)) errors.push("timeframe");
  if (lead.contact_window && !CONTACT_WINDOWS.has(lead.contact_window)) {
    errors.push("contact_window");
  }
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(lead.submission_id)) {
    errors.push("submission_id");
  }
  const textFields = [
    lead.trade_year,
    lead.trade_make,
    lead.trade_model,
    lead.trade_mileage,
    lead.utm_source,
    lead.utm_medium,
    lead.utm_campaign,
    lead.utm_content,
    lead.utm_term,
  ];
  if (textFields.some((value) => value.length > 120 || hasControlCharacters(value))) {
    errors.push("text");
  }
  return [...new Set(errors)];
}

function normalizeLead(raw: Record<string, unknown>): Lead {
  return {
    name: str(raw.name),
    phone: str(raw.phone),
    email: str(raw.email),
    vehicle_type: str(raw.vehicle_type),
    has_trade_in: bool(raw.has_trade_in),
    trade_year: str(raw.trade_year),
    trade_make: str(raw.trade_make),
    trade_model: str(raw.trade_model),
    trade_mileage: str(raw.trade_mileage),
    timeframe: str(raw.timeframe),
    contact_window: str(raw.contact_window),
    submission_id: str(raw.submission_id),
    consent: bool(raw.consent),
    source: "sa-auto-match",
    utm_source: str(raw.utm_source),
    utm_medium: str(raw.utm_medium),
    utm_campaign: str(raw.utm_campaign),
    utm_content: str(raw.utm_content),
    utm_term: str(raw.utm_term),
  };
}

async function markFollowUpError(leadId: string | null): Promise<void> {
  if (!leadId) return;
  try {
    const { error } = await getSupabaseAdmin()
      .from("auto_leads")
      .update({ status: "FOLLOW_UP_ERROR" })
      .eq("id", leadId);
    if (error) console.error("[leads] failed to mark follow-up error:", error);
  } catch (err) {
    console.error("[leads] failed to mark follow-up error:", err);
  }
}

export async function POST(req: Request) {
  if (isRateLimited(req)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  // ---- (a) Parse body -----------------------------------------------------
  let raw: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 }
      );
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid or malformed JSON." },
      { status: 400 }
    );
  }

  // ---- Honeypot -----------------------------------------------------------
  // Bots fill hidden fields. Accept "company" / "website" / "_hp" as traps.
  // If any is filled, pretend success (200) to avoid tipping off the bot,
  // but do NOT persist or dispatch anything.
  const honeypot =
    str(raw.company) || str(raw.website) || str(raw._hp) || str(raw.hp);
  if (honeypot) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const lead = normalizeLead(raw);

  // ---- Validation ---------------------------------------------------------
  const validationErrors = validateLead(raw, lead);
  if (validationErrors.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid or missing field(s): ${validationErrors.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  if (lead.consent !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: "Consent is required to be contacted.",
      },
      { status: 400 }
    );
  }

  if (isDuplicateSubmission(lead.submission_id)) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  // ---- (b) Persist to Supabase FIRST -------------------------------------
  // NOTE: the live `auto_leads` table uses this schema (created in the
  // original project, richer than a flat mirror):
  //   full_name, phone, email, vehicle_interest, current_vehicle, has_trade,
  //   timeframe, consent_sms,
  //   source, utm (jsonb), clickup_task_id, status
  // We map the funnel payload onto it here.
  const currentVehicle = lead.has_trade_in
    ? [lead.trade_year, lead.trade_make, lead.trade_model, lead.trade_mileage]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join(" ")
    : "";

  const utm = {
    utm_source: lead.utm_source || null,
    utm_medium: lead.utm_medium || null,
    utm_campaign: lead.utm_campaign || null,
    utm_content: lead.utm_content || null,
    utm_term: lead.utm_term || null,
    preferred_contact_window: lead.contact_window || null,
    submission_id: lead.submission_id,
  };

  let leadId: string | null = null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("auto_leads")
      .insert({
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email || null,
        vehicle_interest: lead.vehicle_type || null,
        current_vehicle: currentVehicle || null,
        has_trade: lead.has_trade_in,
        timeframe: lead.timeframe || null,
        consent_sms: lead.consent,
        source: lead.source || null,
        utm,
        status: "NEW",
      })
      .select("id")
      .single();

    if (error) {
      releaseSubmission(lead.submission_id);
      console.error("[leads] Supabase insert failed:", error);
      return NextResponse.json(
        { ok: false, error: "Could not save your details. Please try again." },
        { status: 500 }
      );
    }
    leadId = data?.id ?? null;
  } catch (err) {
    releaseSubmission(lead.submission_id);
    console.error("[leads] Unexpected Supabase error:", err);
    return NextResponse.json(
      { ok: false, error: "Could not save your details. Please try again." },
      { status: 500 }
    );
  }

  // ---- (c) Downstream side effects ----------------------------------------
  // The lead is already persisted. ClickUp is the required salesperson
  // handoff; failures are recorded on the lead for reconciliation.
  try {
    const task = await createLeadTask(lead);
    if (!task?.id) {
      await markFollowUpError(leadId);
    } else if (leadId) {
      try {
        const { error } = await getSupabaseAdmin()
          .from("auto_leads")
          .update({ clickup_task_id: task.id })
          .eq("id", leadId);
        if (error) {
          console.error("[leads] failed to write clickup_task_id:", error);
          await markFollowUpError(leadId);
        }
      } catch (err) {
        console.error("[leads] failed to write clickup_task_id:", err);
        await markFollowUpError(leadId);
      }
    }
  } catch (err) {
    console.error("[leads] createLeadTask threw:", err);
    await markFollowUpError(leadId);
  }

  try {
    await sendLeadAlert(lead);
  } catch (err) {
    console.error("[leads] sendLeadAlert threw:", err);
  }

  // ---- (d) Success --------------------------------------------------------
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Method Not Allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
