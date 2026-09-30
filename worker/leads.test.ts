import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClickUpTask,
  clickUpRetryDelaySeconds,
  handleLeadRequest,
  parseDealerDecision,
  parseLeadSubmission,
  submitClickUpTask,
  verifyTurnstileToken,
} from "./leads.ts";

const validSubmission = {
  requestId: "19f6aa5f-1c7f-4bd1-a0fc-aee379189334",
  name: "Test Buyer",
  phone: "(210) 555-0100",
  email: "buyer@example.com",
  vehicleMake: "Ford",
  vehicleModel: "F-150",
  preferredDate: "2026-09-24",
  preferredTimeWindow: "afternoon",
  timezone: "America/Chicago",
  consent: true,
  consentVersion: "lead-contact-v1",
  turnstileToken: "test-turnstile-token",
  source: "landing_page",
};

const testNow = new Date("2026-09-23T19:00:00Z");
const parseTestSubmission = (value: unknown = validSubmission) =>
  parseLeadSubmission(value, testNow);

test("parseLeadSubmission requires explicit consent", () => {
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, consent: false }),
    /consent/i,
  );
});

test("parseLeadSubmission requires a valid request UUID", () => {
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, requestId: "not-a-uuid" }),
    /request/i,
  );
});

test("parseLeadSubmission requires a valid appointment request", () => {
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, preferredDate: "" }),
    /date/i,
  );
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, preferredTimeWindow: "whenever" }),
    /time window/i,
  );
});

test("parseLeadSubmission rejects impossible appointment dates", () => {
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, preferredDate: "2026-99-99" }),
    /date/i,
  );
});

test("parseLeadSubmission enforces San Antonio date boundaries", () => {
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, preferredDate: "2026-09-22" }),
    /past/i,
  );
  assert.doesNotThrow(() =>
    parseLeadSubmission(
      { ...validSubmission, preferredDate: "2026-09-23" },
      new Date("2026-09-24T04:30:00Z"),
    ),
  );
  assert.throws(
    () => parseTestSubmission({ ...validSubmission, preferredDate: "2026-12-23" }),
    /90 days/i,
  );
});

test("parseLeadSubmission normalizes contact details and ignores public notes", () => {
  const parsed = parseTestSubmission({ ...validSubmission, notes: "do not accept this" });

  assert.equal(parsed.phone, "2105550100");
  assert.equal(parsed.email, "buyer@example.com");
  assert.equal("notes" in parsed, false);
  assert.equal(parsed.status, "requested");
});

test("buildClickUpTask clearly labels the request as unconfirmed", () => {
  const task = buildClickUpTask(parseTestSubmission(), 42);

  assert.match(task.name, /^Appointment request —/);
  assert.match(task.markdown_content, /Dealer confirmation: Pending/);
  assert.match(task.markdown_content, /D1 lead reference: 42/);
  assert.deepEqual(task.tags, ["auto-lead", "appointment-request"]);
});

test("ClickUp retry delay uses bounded exponential backoff", () => {
  assert.equal(clickUpRetryDelaySeconds(1), 60);
  assert.equal(clickUpRetryDelaySeconds(2), 120);
  assert.equal(clickUpRetryDelaySeconds(8), 3600);
  assert.equal(clickUpRetryDelaySeconds(50), 3600);
});

test("parseDealerDecision accepts only terminal dealer decisions", () => {
  assert.equal(parseDealerDecision("dealer_confirmed"), "dealer_confirmed");
  assert.equal(parseDealerDecision("dealer_declined"), "dealer_declined");
  assert.equal(parseDealerDecision("forwarded"), null);
  assert.equal(parseDealerDecision("requested"), null);
});

test("handleLeadRequest rejects missing consent without writing PII", async () => {
  let inserts = 0;
  const response = await handleLeadRequest(
    new Request("https://example.test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validSubmission, consent: false }),
    }),
    {
      async insertLeadWithOutbox() {
        inserts += 1;
        throw new Error("must not write");
      },
    },
    () => undefined,
    async () => true,
    testNow,
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(inserts, 0);
});

test("handleLeadRequest rejects failed human verification without writing PII", async () => {
  let inserts = 0;
  const response = await handleLeadRequest(
    new Request("https://example.test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSubmission),
    }),
    {
      async insertLeadWithOutbox() {
        inserts += 1;
        throw new Error("must not write");
      },
    },
    () => undefined,
    async () => false,
    testNow,
  );

  assert.equal(response.status, 403);
  assert.equal(inserts, 0);
});

test("handleLeadRequest rejects an oversized body without a Content-Length header", async () => {
  let inserts = 0;
  const request = new Request("https://example.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validSubmission, padding: "x".repeat(20_000) }),
  });
  request.headers.delete("content-length");

  const response = await handleLeadRequest(
    request,
    {
      async insertLeadWithOutbox() {
        inserts += 1;
        throw new Error("must not write");
      },
    },
    () => undefined,
    async () => true,
    testNow,
  );

  assert.equal(response.status, 413);
  assert.equal(inserts, 0);
});

test("handleLeadRequest returns an opaque idempotent request reference", async () => {
  let scheduled = 0;
  const response = await handleLeadRequest(
    new Request("https://example.test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSubmission),
    }),
    {
      async insertLeadWithOutbox(parsed) {
        assert.equal(parsed.phone, "2105550100");
        return {
          created: true,
          lead: { id: 42 } as never,
        };
      },
    },
    () => {
      scheduled += 1;
    },
    async () => true,
    testNow,
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    accepted: true,
    requestId: validSubmission.requestId,
    status: "requested",
  });
  assert.equal(scheduled, 1);
});

test("handleLeadRequest returns conflict for reused request IDs with different payloads", async () => {
  const response = await handleLeadRequest(
    new Request("https://example.test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSubmission),
    }),
    {
      async insertLeadWithOutbox() {
        const { LeadRequestConflictError } = await import("../server/storage.ts");
        throw new LeadRequestConflictError();
      },
    },
    () => undefined,
    async () => true,
    testNow,
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Request ID was already used for a different submission",
  });
});

test("submitClickUpTask returns the external task id without logging response bodies", async () => {
  const requests: Array<{ url: string; authorization: string | null; body: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)),
    });
    return Response.json({ id: "clickup-task-123" });
  };

  const result = await submitClickUpTask({
    token: "secret-token",
    listId: "list-123",
    task: buildClickUpTask(parseTestSubmission(), 42),
    fetcher,
  });

  assert.deepEqual(result, { ok: true, externalId: "clickup-task-123" });
  assert.equal(requests[0]?.url, "https://api.clickup.com/api/v2/list/list-123/task");
  assert.equal(requests[0]?.authorization, "secret-token");
});

test("submitClickUpTask returns only a redacted failure code", async () => {
  const fetcher: typeof fetch = async () =>
    new Response("response contains sensitive customer data", { status: 429 });

  const result = await submitClickUpTask({
    token: "secret-token",
    listId: "list-123",
    task: buildClickUpTask(parseTestSubmission(), 42),
    fetcher,
  });

  assert.deepEqual(result, {
    ok: false,
    errorCode: "http_429",
    disposition: "retry",
  });
  assert.equal(JSON.stringify(result).includes("customer"), false);
});

test("submitClickUpTask classifies ambiguous outcomes without automatic retry", async () => {
  const task = buildClickUpTask(parseTestSubmission(), 42);
  const serverError = await submitClickUpTask({
    token: "secret-token",
    listId: "list-123",
    task,
    fetcher: async () => new Response(null, { status: 500 }),
  });
  const networkError = await submitClickUpTask({
    token: "secret-token",
    listId: "list-123",
    task,
    fetcher: async () => {
      throw new Error("timeout");
    },
  });

  assert.deepEqual(serverError, {
    ok: false,
    errorCode: "http_500",
    disposition: "reconcile",
  });
  assert.deepEqual(networkError, {
    ok: false,
    errorCode: "network_error",
    disposition: "reconcile",
  });
});

test("verifyTurnstileToken validates the lead action and expected hostname", async () => {
  const verified = await verifyTurnstileToken({
    secret: "turnstile-secret",
    token: "turnstile-token",
    remoteIp: "203.0.113.10",
    expectedHostnames: new Set(["deals.example.com"]),
    fetcher: async (_input, init) => {
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get("secret"), "turnstile-secret");
      assert.equal(params.get("response"), "turnstile-token");
      return Response.json({
        success: true,
        action: "lead_submit",
        hostname: "deals.example.com",
      });
    },
  });

  assert.equal(verified, true);
});

test("verifyTurnstileToken fails closed on mismatched action or provider failure", async () => {
  const mismatch = await verifyTurnstileToken({
    secret: "turnstile-secret",
    token: "turnstile-token",
    remoteIp: null,
    expectedHostnames: new Set(["deals.example.com"]),
    fetcher: async () => Response.json({
      success: true,
      action: "other_action",
      hostname: "deals.example.com",
    }),
  });
  const outage = await verifyTurnstileToken({
    secret: "turnstile-secret",
    token: "turnstile-token",
    remoteIp: null,
    expectedHostnames: new Set(["deals.example.com"]),
    fetcher: async () => {
      throw new Error("network failure");
    },
  });

  assert.equal(mismatch, false);
  assert.equal(outage, false);
});
