import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseStorage } from "./storage.ts";
import type { ParsedLeadSubmission } from "../worker/leads.ts";

const lead: ParsedLeadSubmission = {
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
  consentVersion: "lead-contact-v1",
  consentedAt: 1_790_200_000,
  source: "landing_page",
  utmSource: null,
  utmCampaign: null,
  status: "requested",
};

test("insertLeadWithOutbox atomically deduplicates a request and queues ClickUp delivery", async () => {
  const prepared: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const statement = {
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) {
          statement.values = values;
          prepared.push(statement);
          return statement;
        },
        async first() {
          return {
            id: 42,
            request_id: lead.requestId,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            vehicle_make: lead.vehicleMake,
            vehicle_model: lead.vehicleModel,
            listing_id: null,
            preferred_date: lead.preferredDate,
            preferred_time_window: lead.preferredTimeWindow,
            timezone: lead.timezone,
            consent_given: 1,
            consent_version: lead.consentVersion,
            consented_at: lead.consentedAt,
            source: lead.source,
            utm_source: null,
            utm_campaign: null,
            notes: null,
            status: "requested",
            clickup_task_id: null,
            created_at: lead.consentedAt,
            updated_at: lead.consentedAt,
          };
        },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      assert.equal(statements.length, 2);
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    },
  };

  const storage = new DatabaseStorage(db as unknown as D1Database);
  const result = await storage.insertLeadWithOutbox(lead);

  assert.equal(result.created, true);
  assert.equal(result.lead.id, 42);
  assert.match(prepared[0]?.sql ?? "", /INSERT OR IGNORE INTO leads/);
  assert.match(prepared[1]?.sql ?? "", /INSERT OR IGNORE INTO lead_delivery_outbox/);
  assert.equal(prepared[0]?.values[0], lead.requestId);
});

test("insertLeadWithOutbox rejects a reused request ID with a different payload", async () => {
  const db = {
    prepare() {
      const statement = {
        bind() { return statement; },
        async first() {
          return {
            id: 42,
            request_id: lead.requestId,
            name: "Different Buyer",
            phone: lead.phone,
            email: lead.email,
            vehicle_make: lead.vehicleMake,
            vehicle_model: lead.vehicleModel,
            listing_id: null,
            preferred_date: lead.preferredDate,
            preferred_time_window: lead.preferredTimeWindow,
            timezone: lead.timezone,
            consent_given: 1,
            consent_version: lead.consentVersion,
            consented_at: lead.consentedAt,
            source: lead.source,
            utm_source: null,
            utm_campaign: null,
            notes: null,
            status: "requested",
            delivery_status: "pending",
            clickup_task_id: null,
            created_at: lead.consentedAt,
            updated_at: lead.consentedAt,
          };
        },
      };
      return statement;
    },
    async batch() {
      return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }];
    },
  };

  const storage = new DatabaseStorage(db as unknown as D1Database);
  await assert.rejects(
    () => storage.insertLeadWithOutbox(lead),
    /different submission/i,
  );
});

test("deleteExpiredLead deletes only the selected lead older than the cutoff", async () => {
  let preparedSql = "";
  let boundValues: unknown[] = [];
  const db = {
    prepare(sql: string) {
      preparedSql = sql;
      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return {
            async run() { return { meta: { changes: 1 } }; },
          };
        },
      };
    },
  };

  const storage = new DatabaseStorage(db as unknown as D1Database);
  const deleted = await storage.deleteExpiredLead(42, 1_700_000_000);

  assert.equal(deleted, true);
  assert.match(preparedSql, /DELETE FROM leads WHERE id = \? AND created_at < \?/);
  assert.deepEqual(boundValues, [42, 1_700_000_000]);
});

test("markLeadDeliveryRetry updates lead and outbox lifecycle state together", async () => {
  const sql: string[] = [];
  const db = {
    prepare(statement: string) {
      sql.push(statement);
      const prepared = { bind() { return prepared; } };
      return prepared;
    },
    async batch(statements: unknown[]) {
      assert.equal(statements.length, 2);
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    },
  };

  const storage = new DatabaseStorage(db as unknown as D1Database);
  await storage.markLeadDeliveryRetry(7, 2, 1_700_000_060, "http_429", "claim", 1_700_000_000);

  assert.match(sql[0] ?? "", /delivery_status = 'retryable_failure'/);
  assert.match(sql[1] ?? "", /status = 'retryable_failure'/);
});

test("releaseReconciliationForRetry requires an explicit reconciliation state", async () => {
  const sql: string[] = [];
  const db = {
    prepare(statement: string) {
      sql.push(statement);
      const prepared = { bind() { return prepared; } };
      return prepared;
    },
    async batch(statements: unknown[]) {
      assert.equal(statements.length, 2);
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    },
  };

  const storage = new DatabaseStorage(db as unknown as D1Database);
  const released = await storage.releaseReconciliationForRetry(7, 1_700_000_000);

  assert.equal(released, true);
  assert.match(sql[0] ?? "", /status = 'needs_reconciliation'/);
  assert.match(sql[1] ?? "", /manual_retry_approved/);
});
