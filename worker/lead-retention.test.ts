import assert from "node:assert/strict";
import test from "node:test";

import { purgeExpiredLeadData } from "./lead-retention.ts";

test("retention deletes ClickUp copies before deleting D1 lead PII", async () => {
  const calls: string[] = [];
  const storage = {
    async getExpiredLeadReferences() {
      return [{ id: 42, clickupTaskId: "task-123" }];
    },
    async deleteExpiredLead(id: number) {
      calls.push(`d1:${id}`);
      return true;
    },
  };

  const result = await purgeExpiredLeadData({
    storage,
    cutoffEpoch: 1_700_000_000,
    clickupToken: "secret-token",
    fetcher: async (_input, init) => {
      assert.equal(init?.method, "DELETE");
      calls.push("clickup");
      return new Response(null, { status: 204 });
    },
  });

  assert.deepEqual(calls, ["clickup", "d1:42"]);
  assert.deepEqual(result, { reviewed: 1, deleted: 1, deferred: 0, remaining: false });
});

test("retention preserves D1 reference when ClickUp deletion is uncertain", async () => {
  let d1Deleted = false;
  const result = await purgeExpiredLeadData({
    storage: {
      async getExpiredLeadReferences() {
        return [{ id: 42, clickupTaskId: "task-123" }];
      },
      async deleteExpiredLead() {
        d1Deleted = true;
        return true;
      },
    },
    cutoffEpoch: 1_700_000_000,
    clickupToken: "secret-token",
    fetcher: async () => new Response(null, { status: 500 }),
  });

  assert.equal(d1Deleted, false);
  assert.deepEqual(result, { reviewed: 1, deleted: 0, deferred: 1, remaining: false });
});

test("retention deletes expired D1-only leads without ClickUp credentials", async () => {
  const deleted: number[] = [];
  const result = await purgeExpiredLeadData({
    storage: {
      async getExpiredLeadReferences() {
        return [{ id: 7, clickupTaskId: null }];
      },
      async deleteExpiredLead(id: number) {
        deleted.push(id);
        return true;
      },
    },
    cutoffEpoch: 1_700_000_000,
  });

  assert.deepEqual(deleted, [7]);
  assert.deepEqual(result, { reviewed: 1, deleted: 1, deferred: 0, remaining: false });
});

test("retention advances past deferred rows instead of restarting at the same page", async () => {
  const cursors: number[] = [];
  const pages: Record<number, Array<{ id: number; clickupTaskId: string | null }>> = {
    0: [{ id: 1, clickupTaskId: "task-fails" }, { id: 2, clickupTaskId: null }],
    2: [{ id: 3, clickupTaskId: null }],
  };
  const deleted: number[] = [];

  const result = await purgeExpiredLeadData({
    storage: {
      async getExpiredLeadReferences(_cutoff: number, _limit: number, afterId = 0) {
        cursors.push(afterId);
        return pages[afterId] ?? [];
      },
      async deleteExpiredLead(id: number) {
        deleted.push(id);
        return true;
      },
    },
    cutoffEpoch: 1_700_000_000,
    clickupToken: "secret-token",
    fetcher: async () => new Response(null, { status: 500 }),
    batchSize: 2,
  });

  assert.deepEqual(cursors, [0, 2]);
  assert.deepEqual(deleted, [2, 3]);
  assert.deepEqual(result, { reviewed: 3, deleted: 2, deferred: 1, remaining: false });
});

test("retention reports remaining work when the batch budget is exhausted", async () => {
  let nextId = 1;
  const result = await purgeExpiredLeadData({
    storage: {
      async getExpiredLeadReferences() {
        return [{ id: nextId++, clickupTaskId: null }];
      },
      async deleteExpiredLead() {
        return true;
      },
    },
    cutoffEpoch: 1_700_000_000,
    batchSize: 1,
    maxBatches: 2,
  });

  assert.deepEqual(result, { reviewed: 2, deleted: 2, deferred: 0, remaining: true });
});
