// Dealer notification — Priority #2 from PROJECT_SESSION_LOG.md's Next Build
// Priorities: "Dealer notification on every booked appointment (internet
// manager email/SMS)."
//
// Design rules (same philosophy as sms.ts / ai-setter.ts):
// 1. Never blocks booking. Called fire-and-forget from routes.ts right after
//    the appointment is inserted.
// 2. Sends over whichever channel(s) are configured — SMS via the existing
//    Twilio credentials (DEALER_NOTIFY_NUMBER), email via SMTP
//    (DEALER_NOTIFY_EMAIL + SMTP_*). Either, both, or neither can be set;
//    "neither" just records "skipped".
// 3. Tracked the same way as customer SMS — appointments.dealerNotifyStatus
//    is the audit trail, and it's never re-sent once it leaves "pending".

import nodemailer from "nodemailer";
import { storage } from "./storage";
import { sendRawSms, formatSlotLabel, vehicleLine } from "./sms";
import type { Appointment, BuyerLead, Listing } from "@shared/schema";

const DEALER_NOTIFY_NUMBER = process.env.DEALER_NOTIFY_NUMBER || null;
const DEALER_NOTIFY_EMAIL = process.env.DEALER_NOTIFY_EMAIL || null;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && DEALER_NOTIFY_EMAIL);
}

function isSmsChannelConfigured(): boolean {
  return Boolean(DEALER_NOTIFY_NUMBER);
}

export function isDealerNotifyConfigured(): boolean {
  return isEmailConfigured() || isSmsChannelConfigured();
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (!transporter && isEmailConfigured()) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

async function sendDealerEmail(subject: string, text: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: "email_not_configured" };
  try {
    await t.sendMail({
      from: SMTP_FROM,
      to: DEALER_NOTIFY_EMAIL!,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Fire-and-record: call right after insertAppointment, same as
// sendAppointmentConfirmation. Sends over every configured channel and
// records "sent" if at least one succeeded, "failed" if all configured
// channels failed, "skipped" if nothing is configured at all.
export async function notifyDealer(
  appt: Appointment,
  lead: BuyerLead,
  listing: Listing | null
): Promise<void> {
  if (!isDealerNotifyConfigured()) {
    await storage.updateAppointmentDealerNotifyStatus(appt.id, "skipped");
    return;
  }

  const when = formatSlotLabel(new Date(appt.scheduledAt));
  const where = appt.dealerName ? ` (${appt.dealerName})` : "";
  const vehicle = vehicleLine(listing);
  const setBy = appt.setBy === "ai_setter" ? "AI setter" : appt.setBy === "human" ? "human agent" : "slot picker";

  const attempts: Promise<{ ok: boolean; error?: string }>[] = [];

  if (isSmsChannelConfigured()) {
    attempts.push(
      sendRawSms(
        DEALER_NOTIFY_NUMBER!,
        `DealIntel SA: New appointment${where} — ${lead.name} (${lead.phone}), ${when}, ${vehicle}. Booked via ${setBy}.`
      )
    );
  }

  if (isEmailConfigured()) {
    const subject = `New appointment booked: ${lead.name} — ${when}`;
    const text = [
      `A new appointment was booked${where}.`,
      ``,
      `Buyer: ${lead.name}`,
      `Phone: ${lead.phone}`,
      lead.email ? `Email: ${lead.email}` : null,
      `Vehicle: ${vehicle}`,
      `Time: ${when} (Central)`,
      `Booked via: ${setBy}`,
      appt.notes ? `Notes: ${appt.notes}` : null,
    ].filter(Boolean).join("\n");
    const html = `
      <p>A new appointment was booked${where}.</p>
      <table cellpadding="4" cellspacing="0">
        <tr><td><b>Buyer</b></td><td>${escapeHtml(lead.name)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(lead.phone)}</td></tr>
        ${lead.email ? `<tr><td><b>Email</b></td><td>${escapeHtml(lead.email)}</td></tr>` : ""}
        <tr><td><b>Vehicle</b></td><td>${escapeHtml(vehicle)}</td></tr>
        <tr><td><b>Time</b></td><td>${escapeHtml(when)} (Central)</td></tr>
        <tr><td><b>Booked via</b></td><td>${escapeHtml(setBy)}</td></tr>
        ${appt.notes ? `<tr><td><b>Notes</b></td><td>${escapeHtml(appt.notes)}</td></tr>` : ""}
      </table>`;
    attempts.push(sendDealerEmail(subject, text, html));
  }

  const results = await Promise.all(attempts);
  const anySucceeded = results.some((r) => r.ok);
  await storage.updateAppointmentDealerNotifyStatus(appt.id, anySucceeded ? "sent" : "failed");

  results.filter((r) => !r.ok).forEach((r) => console.error(`Dealer notify failed for appointment ${appt.id}:`, r.error));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
