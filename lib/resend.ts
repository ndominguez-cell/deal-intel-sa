// Optional email alert to the salesperson via the Resend API.
//
// Silently no-ops if any of RESEND_API_KEY, ALERT_EMAIL_FROM, or
// ALERT_EMAIL_TO are unset. NEVER throws — email is a best-effort side
// channel and must never affect the lead-capture request outcome.

import "server-only";
import type { Lead } from "./types";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;

function isHotLead(lead: Lead): boolean {
  const tf = (lead.timeframe || "").trim();
  if (tf === "Today" || tf === "Tomorrow") return true;
  if (lead.has_trade_in && tf === "This week") return true;
  return false;
}

function esc(v: string | undefined | null): string {
  const s = (v ?? "").toString();
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string | undefined | null): string {
  const v = (value ?? "").toString().trim();
  return `<tr><td style="padding:4px 12px 4px 0;color:#666;">${esc(
    label
  )}</td><td style="padding:4px 0;font-weight:600;">${esc(
    v.length ? v : "—"
  )}</td></tr>`;
}

function buildHtml(lead: Lead, hot: boolean): string {
  const tradeRows = lead.has_trade_in
    ? [
        row("Trade year", lead.trade_year),
        row("Trade make", lead.trade_make),
        row("Trade model", lead.trade_model),
        row("Trade mileage", lead.trade_mileage),
      ].join("")
    : row("Trade-in", "None");

  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;">
    <h2 style="margin:0 0 4px;">${hot ? "🔥 HOT LEAD" : "New lead"} — SA Auto Match</h2>
    <p style="margin:0 0 16px;color:#666;">A new lead just came in.</p>
    <table style="border-collapse:collapse;font-size:14px;">
      ${row("Name", lead.name)}
      ${row("Phone", lead.phone)}
      ${row("Email", lead.email)}
      ${row("Vehicle type", lead.vehicle_type)}
      ${row("Has trade-in", lead.has_trade_in ? "Yes" : "No")}
      ${tradeRows}
      ${row("Requested timing", lead.timeframe)}
      ${row("Best contact window", lead.contact_window)}
      ${row("Source", lead.source)}
      ${row("utm_source", lead.utm_source)}
      ${row("utm_medium", lead.utm_medium)}
      ${row("utm_campaign", lead.utm_campaign)}
      ${row("utm_content", lead.utm_content)}
      ${row("utm_term", lead.utm_term)}
    </table>
    <p style="margin:16px 0 0;color:#999;font-size:12px;">
      Follow up within 5 minutes to confirm vehicle availability and the requested visit time.
    </p>
  </div>`;
}

/**
 * Send a lead alert email. Best-effort: no-ops if unconfigured, and never
 * throws on failure.
 */
export async function sendLeadAlert(lead: Lead): Promise<void> {
  if (!RESEND_API_KEY || !ALERT_EMAIL_FROM || !ALERT_EMAIL_TO) {
    // Email alerts are optional — silently skip when not configured.
    return;
  }

  const hot = isHotLead(lead);
  const name = (lead.name || "New lead").trim();
  const subject = `${hot ? "🔥 HOT LEAD" : "New lead"}: ${name}${
    lead.vehicle_type ? ` — ${lead.vehicle_type}` : ""
  }`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ALERT_EMAIL_FROM,
        // ALERT_EMAIL_TO may be a comma-separated list.
        to: ALERT_EMAIL_TO.split(",").map((s) => s.trim()).filter(Boolean),
        subject,
        html: buildHtml(lead, hot),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[resend] Alert email failed: ${res.status} ${res.statusText} ${text}`
      );
      return;
    }

    console.info("[resend] Lead alert email sent.");
  } catch (err) {
    console.error("[resend] Unexpected error sending alert email:", err);
  } finally {
    clearTimeout(timeout);
  }
}
