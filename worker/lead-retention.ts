import type { ExpiredLeadReference } from "../server/storage";

interface RetentionStorage {
  getExpiredLeadReferences(
    cutoffEpoch: number,
    limit: number,
    afterId?: number,
  ): Promise<ExpiredLeadReference[]>;
  deleteExpiredLead(id: number, cutoffEpoch: number): Promise<boolean>;
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_BATCHES = 20;

export async function purgeExpiredLeadData(options: {
  storage: RetentionStorage;
  cutoffEpoch: number;
  clickupToken?: string;
  fetcher?: typeof fetch;
  batchSize?: number;
  maxBatches?: number;
}): Promise<{
  reviewed: number;
  deleted: number;
  deferred: number;
  remaining: boolean;
}> {
  const fetcher = options.fetcher ?? fetch;
  const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH_SIZE, 1), 100);
  const maxBatches = Math.max(options.maxBatches ?? DEFAULT_MAX_BATCHES, 1);

  let reviewed = 0;
  let deleted = 0;
  let deferred = 0;
  let afterId = 0;
  let remaining = false;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const references = await options.storage.getExpiredLeadReferences(
      options.cutoffEpoch,
      batchSize,
      afterId,
    );
    if (references.length === 0) break;

    for (const reference of references) {
      reviewed += 1;
      // Advance the cursor past every reviewed row so deferred ClickUp
      // failures cannot starve newer expired records on later runs.
      afterId = Math.max(afterId, reference.id);

      if (reference.clickupTaskId) {
        if (!options.clickupToken) {
          deferred += 1;
          continue;
        }
        try {
          const response = await fetcher(
            `https://api.clickup.com/api/v2/task/${encodeURIComponent(reference.clickupTaskId)}`,
            {
              method: "DELETE",
              headers: { Authorization: options.clickupToken },
            },
          );
          if (!(response.ok || response.status === 404)) {
            deferred += 1;
            continue;
          }
        } catch {
          deferred += 1;
          continue;
        }
      }

      if (await options.storage.deleteExpiredLead(reference.id, options.cutoffEpoch)) {
        deleted += 1;
      }
    }

    if (references.length < batchSize) break;
    if (batch === maxBatches - 1) remaining = true;
  }

  return { reviewed, deleted, deferred, remaining };
}
