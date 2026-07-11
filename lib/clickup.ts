// ClickUp integration — create a task per captured lead.
//
// Uses the ClickUp API v2 "Create Task" endpoint against CLICKUP_LIST_ID,
// authenticating with a personal/API token in the Authorization header.
//
// This module NEVER throws: on any misconfiguration or API failure it logs
// and returns null so the caller's request can still succeed after the
// lead has been safely persisted in Supabase.

import "server-only";
import type { Lead } from "./types";

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID || "901114100607";

type ClickUpResult = { id: string; url?: string } | null;

/**
 * Hot-lead heuristic:
 *   - timeframe === "This week", OR
 *   - has_trade_in AND timeframe === "This month"
 */
function isHotLead(lead: Lead): boolean {
  const tf = (lead.timeframe || "").trim();
  if (tf === "This week") return true;
  if (lead.has_trade_in && tf === "This month") return true;
  return false;
}

function yn(v: boolean): string {
  return v ? "Yes" : "No";
}

function dash(v: string | undefined | null): string {
  const s = (v ?? "").toString().trim();
  return s.length ? s : "—";
}

function buildDescription(lead: Lead): string {
  const tradeBlock = lead.has_trade_in
    ? [
        `- **Trade year:** ${dash(lead.trade_year)}`,
        `- **Trade make:** ${dash(lead.trade_make)}`,
        `- **Trade model:** ${dash(lead.trade_model)}`,
        `- **Trade mileage:** ${dash(lead.trade_mileage)}`,
      ].join("\n")
    : "- _No trade-in_";

  return [
    `# 🚗 SA Auto Match — Lead Sheet`,
    ``,
    `## Contact`,
    `- **Name:** ${dash(lead.name)}`,
    `- **Phone:** ${dash(lead.phone)}`,
    `- **Email:** ${dash(lead.email)}`,
    ``,
    `## Vehicle Interest`,
    `- **Vehicle type:** ${dash(lead.vehicle_type)}`,
    ``,
    `## Trade-In`,
    `- **Has trade-in:** ${yn(lead.has_trade_in)}`,
    tradeBlock,
    ``,
    `## Budget`,
    `- **Monthly payment target:** ${dash(lead.payment_target)}`,
    `- **Down payment:** ${dash(lead.down_payment)}`,
    `- **Credit band (self-reported):** ${dash(lead.credit_band)}`,
    ``,
    `> ⚠️ Credit band is self-reported by the customer only. It is not a`,
    `> credit score, application, or any financing decision.`,
    ``,
    `## Timing & Consent`,
    `- **Timeframe:** ${dash(lead.timeframe)}`,
    `- **Consent to contact:** ${yn(lead.consent)}`,
    ``,
    `## Attribution`,
    `- **Source:** ${dash(lead.source)}`,
    `- **utm_source:** ${dash(lead.utm_source)}`,
    `- **utm_medium:** ${dash(lead.utm_medium)}`,
    `- **utm_campaign:** ${dash(lead.utm_campaign)}`,
    `- **utm_content:** ${dash(lead.utm_content)}`,
    `- **utm_term:** ${dash(lead.utm_term)}`,
  ].join("\n");
}

/**
 * Create a ClickUp task for a lead. Best-effort: logs and returns null on
 * any failure. Does not throw.
 */
export async function createLeadTask(lead: Lead): Promise<ClickUpResult> {
  if (!CLICKUP_API_TOKEN) {
    console.warn("[clickup] CLICKUP_API_TOKEN not set — skipping task creation.");
    return null;
  }
  if (!CLICKUP_LIST_ID) {
    console.warn("[clickup] CLICKUP_LIST_ID not set — skipping task creation.");
    return null;
  }

  const hot = isHotLead(lead);
  const baseName = `${dash(lead.name)} — ${dash(lead.vehicle_type)}`;
  const name = hot ? `🔥 ${baseName}` : baseName;
  const priority = hot ? 1 : 3; // 1 = Urgent, 3 = Normal

  const body = {
    name,
    markdown_description: buildDescription(lead),
    priority,
  };

  try {
    const res = await fetch(
      `https://api.clickup.com/api/v2/list/${encodeURIComponent(
        CLICKUP_LIST_ID
      )}/task`,
      {
        method: "POST",
        headers: {
          Authorization: CLICKUP_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[clickup] Task creation failed: ${res.status} ${res.statusText} ${text}`
      );
      return null;
    }

    const data = (await res.json().catch(() => null)) as
      | { id?: string; url?: string }
      | null;

    if (!data?.id) {
      console.error("[clickup] Task created but response had no id.");
      return null;
    }

    console.info(
      `[clickup] Created task ${data.id}${hot ? " (HOT LEAD 🔥)" : ""}`
    );
    return { id: data.id, url: data.url };
  } catch (err) {
    console.error("[clickup] Unexpected error creating task:", err);
    return null;
  }
}
