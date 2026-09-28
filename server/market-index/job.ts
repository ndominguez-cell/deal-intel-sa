import type { DatabaseStorage } from "../storage";
import { buildTexasIndex, createMarketCheckFetch, type TexasIndexReport } from "./texas";

export async function refreshTexasIndex(storage: DatabaseStorage, apiKey: string | undefined): Promise<TexasIndexReport> {
  if (!apiKey?.trim()) throw new Error("MARKETCHECK_API_KEY is not configured");

  const job = await storage.insertJobRun("market_index_tx");
  try {
    const previous = await storage.getLatestMarketIndexReport("TX");
    const report = await buildTexasIndex(
      createMarketCheckFetch(apiKey.trim()),
      new Date(),
      // Only live history seeds the series; sample numbers never do.
      previous?.source === "marketcheck" ? previous.series : undefined,
    );
    // A pull where every call failed would publish a flat, empty index; keep the last good report instead.
    if (!report.headline.activeSupply && !report.series.some((p) => p.soldCount > 0)) {
      throw new Error(`Texas index refresh returned no data${report.errors[0] ? `: ${report.errors[0]}` : ""}`);
    }
    await storage.saveMarketIndexReport(report);
    await storage.completeJobRun(job.id, report.series.length, report.errors);
    return report;
  } catch (error) {
    await storage.completeJobRun(job.id, 0, [error instanceof Error ? error.message : String(error)]);
    throw error;
  }
}
