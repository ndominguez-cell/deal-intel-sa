import { z } from "zod";
import type { Lead } from "../shared/schema";
import { addCalendarDays, sanAntonioDate } from "../shared/dates";
import { LeadRequestConflictError } from "../server/storage";

export const CONSENT_VERSION = "lead-contact-v1";
export const APPOINTMENT_TIME_WINDOWS = [
  "morning",
  "midday",
  "afternoon",
  "evening",
] as const;

const leadSubmissionSchema = z
  .object({
    requestId: z.string().uuid("A valid request ID is required"),
    name: z.string().trim().min(2, "Name is required").max(120),
    phone: z.string().trim().max(40).optional().default(""),
    email: z.string().trim().email("A valid email is required").max(160).optional().or(z.literal("")),
    vehicleMake: z.string().trim().max(80).optional().nullable(),
    vehicleModel: z.string().trim().max(80).optional().nullable(),
    listingId: z.number().int().positive().optional().nullable(),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A preferred date is required"),
    preferredTimeWindow: z.enum(APPOINTMENT_TIME_WINDOWS, {
      message: "A valid preferred time window is required",
    }),
    timezone: z.literal("America/Chicago", {
      message: "The appointment timezone must be America/Chicago",
    }),
    consent: z.literal(true, { message: "Explicit consent is required" }),
    consentVersion: z.literal(CONSENT_VERSION, {
      message: "The current consent disclosure is required",
    }),
    turnstileToken: z.string().min(1, "Human verification is required").max(2048),
    source: z.literal("landing_page").default("landing_page"),
    utmSource: z.string().trim().max(120).optional().nullable(),
    utmCampaign: z.string().trim().max(120).optional().nullable(),
  })
  .superRefine((value, context) => {
    const appointmentDate = new Date(`${value.preferredDate}T00:00:00Z`);
    if (
      !Number.isFinite(appointmentDate.getTime()) ||
      appointmentDate.toISOString().slice(0, 10) !== value.preferredDate
    ) {
      context.addIssue({
        code: "custom",
        message: "A valid preferred date is required",
        path: ["preferredDate"],
      });
    }

    const normalizedPhone = value.phone.replace(/\D/g, "");
    if (!normalizedPhone && !value.email) {
      context.addIssue({
        code: "custom",
        message: "A phone number or email is required",
        path: ["phone"],
      });
    }
    if (normalizedPhone && (normalizedPhone.length < 10 || normalizedPhone.length > 15)) {
      context.addIssue({
        code: "custom",
        message: "A valid phone number is required",
        path: ["phone"],
      });
    }
  });

export interface ParsedLeadSubmission {
  requestId: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  listingId: number | null;
  preferredDate: string;
  preferredTimeWindow: (typeof APPOINTMENT_TIME_WINDOWS)[number];
  timezone: "America/Chicago";
  consentVersion: typeof CONSENT_VERSION;
  consentedAt: number;
  source: "landing_page";
  utmSource: string | null;
  utmCampaign: string | null;
  status: "requested";
}


export function parseLeadSubmission(
  value: unknown,
  now: Date = new Date(),
): ParsedLeadSubmission {
  const parsed = leadSubmissionSchema.parse(value);
  const today = sanAntonioDate(now);
  if (parsed.preferredDate < today) {
    throw new z.ZodError([{
      code: "custom",
      message: "The preferred date cannot be in the past",
      path: ["preferredDate"],
    }]);
  }
  if (parsed.preferredDate > addCalendarDays(today, 90)) {
    throw new z.ZodError([{
      code: "custom",
      message: "The preferred date must be within 90 days",
      path: ["preferredDate"],
    }]);
  }
  return {
    requestId: parsed.requestId,
    name: parsed.name,
    phone: parsed.phone ? parsed.phone.replace(/\D/g, "") : null,
    email: parsed.email || null,
    vehicleMake: parsed.vehicleMake || null,
    vehicleModel: parsed.vehicleModel || null,
    listingId: parsed.listingId ?? null,
    preferredDate: parsed.preferredDate,
    preferredTimeWindow: parsed.preferredTimeWindow,
    timezone: parsed.timezone,
    consentVersion: parsed.consentVersion,
    consentedAt: Math.floor(Date.now() / 1_000),
    source: parsed.source,
    utmSource: parsed.utmSource || null,
    utmCampaign: parsed.utmCampaign || null,
    status: "requested",
  };
}

export interface ClickUpTaskPayload {
  name: string;
  markdown_content: string;
  priority: 1 | 2;
  tags: string[];
}

export function buildClickUpTask(
  lead: ParsedLeadSubmission,
  leadId: number,
): ClickUpTaskPayload {
  const vehicle = [lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ") || "Vehicle preference pending";
  const contactLines = [
    lead.phone ? `- Phone: ${lead.phone}` : null,
    lead.email ? `- Email: ${lead.email}` : null,
  ].filter(Boolean);

  return {
    name: `Appointment request — ${lead.name} — ${vehicle}`,
    markdown_content: [
      "## Buyer appointment request",
      "",
      `- Name: ${lead.name}`,
      ...contactLines,
      `- Vehicle: ${vehicle}`,
      `- Preferred date: ${lead.preferredDate}`,
      `- Preferred time: ${lead.preferredTimeWindow} (${lead.timezone})`,
      "- Dealer confirmation: Pending",
      `- Consent disclosure: ${lead.consentVersion}`,
      `- D1 lead reference: ${leadId}`,
      `- Request reference: ${lead.requestId}`,
      "",
      "This is a requested appointment window, not a dealer-confirmed appointment.",
    ].join("\n"),
    priority: 1,
    tags: ["auto-lead", "appointment-request"],
  };
}

export type ClickUpSubmissionResult =
  | { ok: true; externalId: string }
  | {
      ok: false;
      errorCode: string;
      disposition: "retry" | "reconcile" | "fail";
    };

export function clickUpRetryDelaySeconds(attemptCount: number): number {
  return Math.min(60 * 2 ** Math.max(0, attemptCount - 1), 3_600);
}

export type DealerDecision = "dealer_confirmed" | "dealer_declined";

export function parseDealerDecision(value: unknown): DealerDecision | null {
  return value === "dealer_confirmed" || value === "dealer_declined"
    ? value
    : null;
}

export async function verifyTurnstileToken(options: {
  secret: string;
  token: string;
  remoteIp: string | null;
  expectedHostnames: ReadonlySet<string>;
  fetcher?: typeof fetch;
}): Promise<boolean> {
  if (!options.token || options.token.length > 2048 || options.expectedHostnames.size === 0) {
    return false;
  }

  const body = new URLSearchParams({
    secret: options.secret,
    response: options.token,
    idempotency_key: crypto.randomUUID(),
  });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);

  try {
    const response = await (options.fetcher ?? fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return false;
    const result = await response.json() as {
      success?: unknown;
      action?: unknown;
      hostname?: unknown;
    };
    return result.success === true &&
      result.action === "lead_submit" &&
      typeof result.hostname === "string" &&
      options.expectedHostnames.has(result.hostname);
  } catch {
    return false;
  }
}

interface LeadIntakeStorage {
  insertLeadWithOutbox(data: ParsedLeadSubmission): Promise<{
    lead: Lead;
    created: boolean;
  }>;
}

function leadJson(data: unknown, status: number): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleLeadRequest(
  request: Request,
  storage: LeadIntakeStorage,
  scheduleDelivery: () => void,
  verifyHuman: (token: string) => Promise<boolean>,
  now: Date = new Date(),
): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return leadJson({ error: "Content-Type must be application/json" }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 16_384) {
    return leadJson({ error: "Request body is too large" }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
    return leadJson({ error: "Request body is too large" }, 413);
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return leadJson({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return leadJson({ error: "Invalid JSON" }, 400);
  }
  if (typeof body.website === "string" && body.website.trim()) {
    return leadJson({ accepted: true }, 202);
  }

  try {
    const parsed = parseLeadSubmission(body, now);
    if (!(await verifyHuman(String(body.turnstileToken)))) {
      return leadJson({ error: "Human verification failed" }, 403);
    }
    const result = await storage.insertLeadWithOutbox(parsed);
    scheduleDelivery();
    return leadJson(
      {
        accepted: true,
        requestId: parsed.requestId,
        status: "requested",
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return leadJson({ error: error.issues[0]?.message ?? "Invalid submission" }, 400);
    }
    if (error instanceof LeadRequestConflictError) {
      return leadJson(
        { error: "Request ID was already used for a different submission" },
        409,
      );
    }
    throw error;
  }
}

export async function submitClickUpTask(options: {
  token: string;
  listId: string;
  task: ClickUpTaskPayload;
  fetcher?: typeof fetch;
}): Promise<ClickUpSubmissionResult> {
  const fetcher = options.fetcher ?? fetch;
  try {
    const response = await fetcher(
      `https://api.clickup.com/api/v2/list/${encodeURIComponent(options.listId)}/task`,
      {
        method: "POST",
        headers: {
          Authorization: options.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options.task),
      },
    );
    if (!response.ok) {
      const disposition = response.status === 429
        ? "retry"
        : response.status >= 500
          ? "reconcile"
          : "fail";
      return {
        ok: false,
        errorCode: `http_${response.status}`,
        disposition,
      };
    }

    const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
    if (typeof body?.id !== "string" || !body.id) {
      return {
        ok: false,
        errorCode: "invalid_response",
        disposition: "reconcile",
      };
    }
    return { ok: true, externalId: body.id };
  } catch {
    return {
      ok: false,
      errorCode: "network_error",
      disposition: "reconcile",
    };
  }
}
