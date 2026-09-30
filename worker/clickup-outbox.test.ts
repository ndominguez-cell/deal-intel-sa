import assert from "node:assert/strict";
import test from "node:test";

import type { Lead } from "../shared/schema.ts";
import { processClickUpDeliveries } from "./clickup-outbox.ts";

const lead: Lead = {
  id: 42,
  requestId: "19f6aa5f-1c7f-4bd1-a0fc-aee379189334",
  name: "Test Buyer",
  phone: "2105550100",
  email: "buyer@example.com",
  vehicleMake: "Ford",
  vehicleModel: "F-150",
  listingId: null,
  preferredDate: "2026-09-24",
  preferredTimeWindow: "afternoon",
  timezone: "America/Chicago",
  consentGiven: true,
  consentVersion: "lead-contact-v1",
  consentedAt: new Date("2026-09-23T19:00:00Z"),
  source: "landing_page",
  utmSource: null,
  utmCampaign: null,
  notes: null,
  status: "requested",
  deliveryStatus: "pending",
  clickupTaskId: null,
  createdAt: new Date("2026-09-23T19:00:00Z"),
  updatedAt: new Date("2026-09-23T19:00:00Z"),
};

function baseStorage(deliveries = [{ outboxId: 7, attemptCount: 0, lead }]) {
  return {
    async markStaleLeadDeliveriesForReconciliation() {},
    async claimDueLeadDeliveries() {
      return deliveries;
    },
    async markLeadDelivered() {},
    async markLeadDeliveryRetry() {},
    async markLeadDeliveryFailed() {},
    async markLeadDeliveryNeedsReconciliation() {},
  };
}

test("processClickUpDeliveries claims and marks a successful task as forwarded", async () => {
  const delivered: unknown[][] = [];
  const storage = {
    ...baseStorage(),
    async markLeadDelivered(...args: unknown[]) {
      delivered.push(args);
    },
  };

  const result = await processClickUpDeliveries({
    storage,
    token: "secret-token",
    listId: "list-123",
    nowEpoch: 1_790_200_000,
    claimToken: "claim-123",
    fetcher: async () => Response.json({ id: "task-123" }),
  });

  assert.deepEqual(result, {
    processed: 1,
    delivered: 1,
    retried: 0,
    failed: 0,
    reconciliation: 0,
  });
  assert.deepEqual(delivered, [
    [7, 42, "task-123", "claim-123", 1_790_200_000],
  ]);
});

test("processClickUpDeliveries schedules a redacted retry for a definite rejection", async () => {
  const retries: unknown[][] = [];
  const storage = {
    ...baseStorage(),
    async markLeadDeliveryRetry(...args: unknown[]) {
      retries.push(args);
    },
  };

  const result = await processClickUpDeliveries({
    storage,
    token: "secret-token",
    listId: "list-123",
    nowEpoch: 1_790_200_000,
    claimToken: "claim-123",
    fetcher: async () => new Response("sensitive body", { status: 429 }),
  });

  assert.deepEqual(result, {
    processed: 1,
    delivered: 0,
    retried: 1,
    failed: 0,
    reconciliation: 0,
  });
  assert.deepEqual(retries, [
    [7, 1, 1_790_200_060, "http_429", "claim-123", 1_790_200_000],
  ]);
});

test("processClickUpDeliveries quarantines ambiguous ClickUp outcomes", async () => {
  const reconciliations: unknown[][] = [];
  const storage = {
    ...baseStorage(),
    async markLeadDeliveryNeedsReconciliation(...args: unknown[]) {
      reconciliations.push(args);
    },
  };

  const result = await processClickUpDeliveries({
    storage,
    token: "secret-token",
    listId: "list-123",
    nowEpoch: 1_790_200_000,
    claimToken: "claim-123",
    fetcher: async () => new Response(null, { status: 500 }),
  });

  assert.deepEqual(result, {
    processed: 1,
    delivered: 0,
    retried: 0,
    failed: 0,
    reconciliation: 1,
  });
  assert.deepEqual(reconciliations, [
    [7, 1, "http_500", "claim-123", 1_790_200_000],
  ]);
});

test("processClickUpDeliveries permanently fails invalid lead records", async () => {
  const failures: unknown[][] = [];
  const storage = {
    ...baseStorage([{ outboxId: 7, attemptCount: 0, lead: { ...lead, consentGiven: false } }]),
    async markLeadDeliveryFailed(...args: unknown[]) {
      failures.push(args);
    },
  };

  const result = await processClickUpDeliveries({
    storage,
    token: "secret-token",
    listId: "list-123",
    nowEpoch: 1_790_200_000,
    claimToken: "claim-123",
  });

  assert.equal(result.failed, 1);
  assert.deepEqual(failures, [
    [7, 1, "invalid_lead", "claim-123", 1_790_200_000],
  ]);
});
