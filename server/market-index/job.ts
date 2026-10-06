import type { DatabaseStorage } from "../storage";
import { buildTexasIndex, createMarketCheckFetch, isPublishableReport, MAX_FAILED_REQUESTS, type TexasIndexReport } from "./texas";

// Cron triggers have fired twice for one schedule; a second run this soon is skipped
// so it doesn't spend another ~77 MarketCheck requests.
export const DUPLICATE_RUN_WINDOW_SECONDS = 6 * 60 * 60;

export class DuplicateRunError extends Error {}

export async function refreshTexasIndex(
  storage: DatabaseStorage,
  apiKey: string | undefined,
  options: { skipIfRecentRun?: boolean } = {},
): Promise<TexasIndexReport> {
  if (!apiKey?.trim()) throw new Error("MARKETCHECK_API_KEY is not configured");
  if (options.skipIfRecentRun) {
    const lastStart = await storage.getLatestJobStart("market_index_tx");
    if (lastStart != null && Date.now() / 1000 - lastStart < DUPLICATE_RUN_WINDOW_SECONDS) {
      throw new DuplicateRunError("Texas index refresh skipped: another run started within the last 6 hours");
    }
  }

  const job = await storage.insertJobRun("market_index_tx");
  try {
    const previous = await storage.getLatestMarketIndexReport("TX");
    const report = await buildTexasIndex(
      createMarketCheckFetch(apiKey.trim()),
      new Date(),
      // Only live history seeds the series; sample numbers never do.
      previous?.source === "marketcheck" ? previous.series : undefined,
    );
    // A rate-limited or quota-exhausted pull would publish zeros (the merged history alone
    // still looks populated), so it is never saved; the last good report stays live.
    if (!isPublishableReport(report)) {
      throw new Error(
        `Texas index refresh not published: ${report.errors.length} failed requests (max ${MAX_FAILED_REQUESTS})` +
          (report.errors[0] ? `; first: ${report.errors[0]}` : ""),
      );
    }
    await storage.saveMarketIndexReport(report);
    await storage.completeJobRun(job.id, report.series.length, report.errors);
    return report;
  } catch (error) {
    await storage.completeJobRun(job.id, 0, [error instanceof Error ? error.message : String(error)]);
    throw error;
  }
}
