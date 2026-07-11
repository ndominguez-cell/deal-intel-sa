// SA Auto Match — lead capture endpoint.
//
// POST flow (order matters):
//   (a) parse + validate body; honeypot + consent checks; require name,
//       phone, consent === true -> 400 on failure.
//   (b) insert into Supabase `auto_leads` FIRST. If this fails, return 500;
//       the lead has not been dispatched anywhere else, so nothing is lost.
//   (c) best-effort createLeadTask (ClickUp) + sendLeadAlert (Resend), each
//       wrapped so a failure NEVER 500s the request or loses the lead.
//   (d) return 200 { ok: true }.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createLeadTask } from "@/lib/clickup";
import { sendLeadAlert } from "@/lib/resend";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    payment_target: str(raw.payment_target),
    down_payment: str(raw.down_payment),
    credit_band: str(raw.credit_band),
    timeframe: str(raw.timeframe),
    consent: bool(raw.consent),
    source: str(raw.source),
    utm_source: str(raw.utm_source),
    utm_medium: str(raw.utm_medium),
    utm_campaign: str(raw.utm_campaign),
    utm_content: str(raw.utm_content),
    utm_term: str(raw.utm_term),
  };
}

export async function POST(req: Request) {
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
  const missing: string[] = [];
  if (!lead.name) missing.push("name");
  if (!lead.phone) missing.push("phone");
  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `Missing required field(s): ${missing.join(", ")}.`,
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

  // ---- (b) Persist to Supabase FIRST -------------------------------------
  // NOTE: the live `auto_leads` table uses this schema (created in the
  // original project, richer than a flat mirror):
  //   full_name, phone, email, vehicle_interest, current_vehicle, has_trade,
  //   down_payment, payment_target, credit_band, timeframe, consent_sms,
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
        down_payment: lead.down_payment || null,
        payment_target: lead.payment_target || null,
        credit_band: lead.credit_band || null,
        timeframe: lead.timeframe || null,
        consent_sms: lead.consent,
        source: lead.source || null,
        utm,
        status: "NEW",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[leads] Supabase insert failed:", error);
      return NextResponse.json(
        { ok: false, error: "Could not save your details. Please try again." },
        { status: 500 }
      );
    }
    leadId = data?.id ?? null;
  } catch (err) {
    console.error("[leads] Unexpected Supabase error:", err);
    return NextResponse.json(
      { ok: false, error: "Could not save your details. Please try again." },
      { status: 500 }
    );
  }

  // ---- (c) Best-effort downstream side effects ----------------------------
  // The lead is safely stored. From here, nothing may cause a 500 or data
  // loss — every side effect is isolated and swallowed.
  try {
    const task = await createLeadTask(lead);
    // Write the ClickUp task id back onto the lead row (best-effort).
    if (task?.id && leadId) {
      try {
        await getSupabaseAdmin()
          .from("auto_leads")
          .update({ clickup_task_id: task.id })
          .eq("id", leadId);
      } catch (err) {
        console.error("[leads] failed to write clickup_task_id (ignored):", err);
      }
    }
  } catch (err) {
    console.error("[leads] createLeadTask threw (ignored):", err);
  }

  try {
    await sendLeadAlert(lead);
  } catch (err) {
    console.error("[leads] sendLeadAlert threw (ignored):", err);
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
