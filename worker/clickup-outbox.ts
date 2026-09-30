import type { DueLeadDelivery } from "../server/storage";
import type { Lead } from "../shared/schema";
import {
  buildClickUpTask,
  clickUpRetryDelaySeconds,
  CONSENT_VERSION,
  submitClickUpTask,
  type ParsedLeadSubmission,
} from "./leads";

interface ClickUpDeliveryStorage {
  claimDueLeadDeliveries(
    limit: number,
    nowEpoch: number,
    claimToken: string,
  ): Promise<DueLeadDelivery[]>;
  markStaleLeadDeliveriesForReconciliation(nowEpoch: number): Promise<void>;
  markLeadDelivered(
    outboxId: number,
    leadId: number,
    externalId: string,
    claimToken: string,
    nowEpoch: number,
  ): Promise<void>;
  markLeadDeliveryRetry(
    outboxId: number,
    attemptCount: number,
    nextAttemptAt: number,
    errorCode: string,
    claimToken: string,
    nowEpoch: number,
  ): Promise<void>;
  markLeadDeliveryFailed(
    outboxId: number,
    attemptCount: number,
    errorCode: string,
    claimToken: string,
    nowEpoch: number,
  ): Promise<void>;
  markLeadDeliveryNeedsReconciliation(
    outboxId: number,
    attemptCount: number,
    errorCode: string,
    claimToken: string,
    nowEpoch: number,
  ): Promise<void>;
}

function deliveryLead(lead: Lead): ParsedLeadSubmission | null {
  if (
    !lead.requestId ||
    !lead.preferredDate ||
    !lead.preferredTimeWindow ||
    lead.timezone !== "America/Chicago" ||
    !lead.consentGiven ||
    lead.consentVersion !== CONSENT_VERSION ||
    !lead.consentedAt
  ) {
    return null;
  }
  if (!["morning", "midday", "afternoon", "evening"].includes(lead.preferredTimeWindow)) {
    return null;
  }

  return {
    requestId: lead.requestId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    vehicleMake: lead.vehicleMake,
    vehicleModel: lead.vehicleModel,
    listingId: lead.listingId,
    preferredDate: lead.preferredDate,
    preferredTimeWindow: lead.preferredTimeWindow as ParsedLeadSubmission["preferredTimeWindow"],
    timezone: "America/Chicago",
    consentVersion: CONSENT_VERSION,
    consentedAt: Math.floor(lead.consentedAt.getTime() / 1_000),
    source: "landing_page",
    utmSource: lead.utmSource,
    utmCampaign: lead.utmCampaign,
    status: "requested",
  };
}

export async function processClickUpDeliveries(options: {
  storage: ClickUpDeliveryStorage;
  token: string;
  listId: string;
  nowEpoch?: number;
  fetcher?: typeof fetch;
  limit?: number;
  claimToken?: string;
}): Promise<{
  processed: number;
  delivered: number;
  retried: number;
  failed: number;
  reconciliation: number;
}> {
  const nowEpoch = options.nowEpoch ?? Math.floor(Date.now() / 1_000);
  const claimToken = options.claimToken ?? crypto.randomUUID();
  await options.storage.markStaleLeadDeliveriesForReconciliation(nowEpoch);
  const deliveries = await options.storage.claimDueLeadDeliveries(
    options.limit ?? 10,
    nowEpoch,
    claimToken,
  );
  let delivered = 0;
  let retried = 0;
  let failed = 0;
  let reconciliation = 0;

  for (const delivery of deliveries) {
    const nextAttempt = delivery.attemptCount + 1;
    const parsed = deliveryLead(delivery.lead);
    const result = parsed
      ? await submitClickUpTask({
          token: options.token,
          listId: options.listId,
          task: buildClickUpTask(parsed, delivery.lead.id),
          fetcher: options.fetcher,
        })
      : {
          ok: false as const,
          errorCode: "invalid_lead",
          disposition: "fail" as const,
        };

    if (result.ok) {
      await options.storage.markLeadDelivered(
        delivery.outboxId,
        delivery.lead.id,
        result.externalId,
        claimToken,
        nowEpoch,
      );
      delivered += 1;
    } else if (result.disposition === "retry" && nextAttempt < 8) {
      await options.storage.markLeadDeliveryRetry(
        delivery.outboxId,
        nextAttempt,
        nowEpoch + clickUpRetryDelaySeconds(nextAttempt),
        result.errorCode,
        claimToken,
        nowEpoch,
      );
      retried += 1;
    } else if (result.disposition === "reconcile") {
      await options.storage.markLeadDeliveryNeedsReconciliation(
        delivery.outboxId,
        nextAttempt,
        result.errorCode,
        claimToken,
        nowEpoch,
      );
      reconciliation += 1;
    } else {
      await options.storage.markLeadDeliveryFailed(
        delivery.outboxId,
        nextAttempt,
        result.errorCode,
        claimToken,
        nowEpoch,
      );
      failed += 1;
    }
  }

  return {
    processed: deliveries.length,
    delivered,
    retried,
    failed,
    reconciliation,
  };
}
