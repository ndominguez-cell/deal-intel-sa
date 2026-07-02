import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runIngestion, runScoring } from "./engine/jobs";
import { SA_CENTROID, haversineDistance } from "./engine/constants";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), region: "San Antonio, TX" });
  });

  app.get("/api/deals/top", async (req, res) => {
    try {
      const minScore = parseFloat(req.query.min_score as string) || 0;
      const limit = parseInt(req.query.limit as string) || 50;

      const deals = await storage.getTopDeals(minScore, limit);

      const results = deals.map((deal, idx) => ({
        rank: idx + 1,
        listing: {
          id: deal.id,
          year: deal.year,
          make: deal.make,
          model: deal.model,
          trim: deal.trim,
          bodyType: deal.bodyType,
          price: deal.price,
          mileage: deal.mileage,
          city: deal.city,
          state: deal.state,
          distance: deal.lat && deal.lon
            ? Math.round(haversineDistance(SA_CENTROID.lat, SA_CENTROID.lon, deal.lat, deal.lon))
            : null,
          dealerName: deal.dealerName,
          isDealer: deal.isDealer,
          listingUrl: deal.listingUrl,
          titleStatus: deal.titleStatus,
          imageUrls: deal.imageUrls,
          firstSeenAt: deal.firstSeenAt,
          lastSeenAt: deal.lastSeenAt,
        },
        score: {
          dealScore: deal.score.dealScore,
          marketValueEst: deal.score.marketValueEst,
          compCount: deal.score.compCount,
          compPriceMedian: deal.score.compPriceMedian,
          confidence: deal.score.confidence,
          savingsAmount: deal.score.savingsAmount,
          scoreBreakdown: deal.score.scoreBreakdown,
          scoreReasons: deal.score.scoreReasons,
          velocityPrediction: deal.score.velocityPrediction,
          wholesaleEstimate: deal.score.wholesaleEstimate,
          suggestedOffer: deal.score.suggestedOffer,
        },
      }));

      res.json({ deals: results, total: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const listing = await storage.getListingById(id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const score = await storage.getDealScoreForListing(id);
      const snapshots = await storage.getSnapshotsForListing(id);

      res.json({
        listing,
        score: score || null,
        priceHistory: snapshots.map((s) => ({
          price: s.price,
          mileage: s.mileage,
          date: s.snapshotAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stats/market", async (req, res) => {
    try {
      const city = (req.query.city as string) || "San Antonio";
      const make = req.query.make as string;
      const model = req.query.model as string;

      if (make && model) {
        const comp = await storage.getMarketCompsByMakeModel(city, make, model);
        if (!comp) return res.status(404).json({ error: "No market data for this make/model" });
        return res.json(comp);
      }

      const comps = await storage.getMarketComps(city);
      res.json({ city, segments: comps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stats/overview", async (req, res) => {
    try {
      const totalListings = await storage.getListingsCount();
      const topDeals = await storage.getTopDeals(85, 999);
      const priceDrops = await storage.getPriceDropCount24h();
      const comps = await storage.getMarketComps("San Antonio");

      res.json({
        totalListings,
        belowMarketToday: topDeals.length,
        avgDealScore: topDeals.length > 0
          ? Math.round(topDeals.reduce((s, d) => s + d.score.dealScore, 0) / topDeals.length)
          : 0,
        priceDrops24h: priceDrops,
        marketIndex: comps,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/jobs/ingest", async (_req, res) => {
    try {
      const result = await runIngestion();
      res.json({ status: "completed", ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/jobs/score", async (_req, res) => {
    try {
      const result = await runScoring();
      res.json({ status: "completed", ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
