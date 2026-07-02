// SMS confirmations + reminders — the #1 no-show killer per the pilot plan.
//
// Design rules (mirrors ai-setter.ts):
// 1. Never blocks the booking flow. A booking always succeeds even if the
//    SMS send fails or Twilio isn't configured — this module only ever
//    records status, it never throws back into the caller's booking path.
// 2. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
//    TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID. Without them,
//    every send is recorded as "skipped" so the reminder sweep never
//    silently retries forever.
// 3. TCPA: consent was already captured at lead capture (consentTcpa).
//    Every outbound message carries "Reply STOP to opt out" and every send
//    checks buyerLeads.smsOptOut first. Inbound STOP/START is handled by
//    the /api/sms/inbound webhook in routes.ts.

import { storage } from "./storage";
import type { Appointment, BuyerLead, Listing } from "@shared/schema";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

export function isSmsConfigured(): boolean {
  return Boolean(TWILIO_SID && TWILIO_TOKEN && (TWILIO_FROM || TWILIO_MESSAGING_SERVICE_SID));
}

export function formatSlotLabel(scheduledAt: Date): string {
  return scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function vehicleLine(listing: Listing | null): string {
  if (!listing) return "your visit";
  return [listing.year, listing.make, listing.model].filter(Boolean).join(" ");
}

// Exported so other channels (e.g. dealer-notify.ts) can send a plain SMS
// through the same Twilio credentials without duplicating the REST call.
export async function sendRawSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSmsConfigured()) return { ok: false, error: "sms_not_configured" };

  try {
    const params = new URLSearchParams();
    params.set("To", to);
    params.set("Body", body);
    if (TWILIO_MESSAGING_SERVICE_SID) {
      params.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else {
      params.set("From", TWILIO_FROM!);
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
        },
        body: params,
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${errBody.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Fire-and-record: sends the confirmation immediately after booking (either
// slot-picker or AI setter path). Idempotent per appointment — routes.ts only
// calls this once, right after insertAppointment.
export async function sendAppointmentConfirmation(
  appt: Appointment,
  lead: BuyerLead,
  listing: Listing | null
): Promise<void> {
  if (lead.smsOptOut) {
    await storage.updateAppointmentSmsStatus(appt.id, "confirmation", "skipped");
    return;
  }
  if (!lead.consentTcpa) {
    await storage.updateAppointmentSmsStatus(appt.id, "confirmation", "skipped");
    return;
  }
  if (!isSmsConfigured()) {
    await storage.updateAppointmentSmsStatus(appt.id, "confirmation", "skipped");
    return;
  }

  const when = formatSlotLabel(new Date(appt.scheduledAt));
  const where = appt.dealerName ? ` at ${appt.dealerName}` : "";
  const body = `DealIntel SA: You're booked for ${when}${where} to see the ${vehicleLine(listing)}. We'll text a reminder the day before. Reply STOP to opt out.`;

  const result = await sendRawSms(lead.phone, body);
  await storage.updateAppointmentSmsStatus(appt.id, "confirmation", result.ok ? "sent" : "failed");
}

// Called by the reminder sweep job (see engine/jobs.ts). Sends exactly once
// per appointment — the caller only passes appointments whose
// reminderSmsStatus is still "pending" inside the 24h window.
export async function sendAppointmentReminder(
  appt: Appointment,
  lead: BuyerLead,
  listing: Listing | null
): Promise<{ status: "sent" | "skipped" | "failed" }> {
  if (lead.smsOptOut || !lead.consentTcpa) {
    await storage.updateAppointmentSmsStatus(appt.id, "reminder", "skipped");
    return { status: "skipped" };
  }
  if (!isSmsConfigured()) {
    await storage.updateAppointmentSmsStatus(appt.id, "reminder", "skipped");
    return { status: "skipped" };
  }
  if (appt.status === "cancelled" || appt.status === "no_show") {
    await storage.updateAppointmentSmsStatus(appt.id, "reminder", "skipped");
    return { status: "skipped" };
  }

  const when = formatSlotLabel(new Date(appt.scheduledAt));
  const where = appt.dealerName ? ` at ${appt.dealerName}` : "";
  const body = `DealIntel SA reminder: your visit for the ${vehicleLine(listing)} is tomorrow, ${when}${where}. Reply C to confirm or call us to reschedule. Reply STOP to opt out.`;

  const result = await sendRawSms(lead.phone, body);
  const status = result.ok ? "sent" : "failed";
  await storage.updateAppointmentSmsStatus(appt.id, "reminder", status);
  return { status };
}

// Inbound webhook handler (STOP/START/HELP) — used by routes.ts.
// Returns TwiML so Twilio doesn't also fire its own default auto-reply.
export async function handleInboundSms(from: string, body: string): Promise<string> {
  const normalized = body.trim().toUpperCase();
  let reply = "";

  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(normalized)) {
    await storage.setSmsOptOutByPhone(from, true);
    reply = "You've been unsubscribed from DealIntel SA texts. Reply START to resubscribe.";
  } else if (["START", "YES", "UNSTOP"].includes(normalized)) {
    await storage.setSmsOptOutByPhone(from, false);
    reply = "You're resubscribed to DealIntel SA texts. Reply STOP anytime to opt out.";
  } else if (normalized === "HELP") {
    reply = "DealIntel SA: msg & data rates may apply. Reply STOP to opt out. Questions? Call your dealer contact.";
  } else {
    // C / CONFIRM or anything else — no auto status change, dealership follows up.
    reply = "Thanks! We've noted your reply — see you at your appointment.";
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
