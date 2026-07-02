import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runIngestion, runScoring, runReminderSweep, runLiveIngestion } from "./engine/jobs";
import { parseCsv, mapDealerRow } from "./engine/csv-import";
import { getAvailableSlots, runSetterTurn, type SetterDealContext } from "./ai-setter";
import { SA_CENTROID, haversineDistance } from "./engine/constants";
import { sendAppointmentConfirmation, handleInboundSms } from "./sms";
import { notifyDealer } from "./dealer-notify";
import { isMarketCheckConfigured } from "./engine/sources/marketcheck";
import { runCalibrationAnalysis } from "./engine/calibration";

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
          urgency: (deal.score as any).urgency,
          daysOnMarket: (deal.score as any).daysOnMarket,
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

  // Hot leads: high score, verified by real comps, ranked by urgency then score.
  // This is the "call these sellers first" list.
  app.get("/api/deals/hot", async (req, res) => {
    try {
      const minScore = parseFloat(req.query.min_score as string) || 75;
      const minConfidence = parseFloat(req.query.min_confidence as string) || 0.4;
      const deals = await storage.getTopDeals(minScore, 100);
      const urgencyRank: Record<string, number> = { act_now: 0, strong_lead: 1, negotiate: 2, monitor: 3, pass: 4 };

      const hot = deals
        .filter((d) => (d.score.confidence ?? 0) >= minConfidence && d.titleStatus === "clean")
        .sort((a, b) => {
          const ua = urgencyRank[(a.score as any).urgency ?? "monitor"] ?? 3;
          const ub = urgencyRank[(b.score as any).urgency ?? "monitor"] ?? 3;
          if (ua !== ub) return ua - ub;
          return b.score.dealScore - a.score.dealScore;
        })
        .map((d) => ({
          listingId: d.id,
          vehicle: `${d.year} ${d.make} ${d.model}${d.trim ? " " + d.trim : ""}`,
          price: d.price,
          marketValueEst: d.score.marketValueEst,
          savingsAmount: d.score.savingsAmount,
          dealScore: d.score.dealScore,
          confidence: d.score.confidence,
          urgency: (d.score as any).urgency,
          daysOnMarket: (d.score as any).daysOnMarket,
          suggestedOffer: d.score.suggestedOffer,
          seller: d.dealerName || "Private Seller",
          city: d.city,
          listingUrl: d.listingUrl,
        }));

      res.json({ hotLeads: hot, total: hot.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Lead pipeline: save a deal as a lead, work it, close it ──
  app.get("/api/leads", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const rows = await storage.getLeads(status);
      res.json({ leads: rows, total: rows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const listingId = parseInt(req.body.listingId);
      if (!listingId) return res.status(400).json({ error: "listingId required" });
      const listing = await storage.getListingById(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      const score = await storage.getDealScoreForListing(listingId);
      const lead = await storage.upsertLead({
        listingId,
        priceAtSave: listing.price ?? null,
        scoreAtSave: score?.dealScore ?? null,
        scoreBreakdownAtSave: score?.scoreBreakdown ?? null,
        urgencyAtSave: score?.urgency ?? null,
      });
      res.json({ lead });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, notes } = req.body;
      const allowed = ["new", "contacted", "negotiating", "won", "lost"];
      if (status && !allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      }
      const lead = await storage.updateLead(id, { status, notes });
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json({ lead });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      await storage.deleteLead(parseInt(req.params.id));
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PUBLIC deal feed for the buyer landing page ──
  // Sanitized: NO wholesale estimates, NO suggested offers, NO internal urgency.
  // Those are acquisition tools; showing them to buyers undercuts partner dealers.
  app.get("/api/deals/public", async (req, res) => {
    try {
      const dealer = req.query.dealer as string | undefined;
      const limit = parseInt(req.query.limit as string) || 10;
      const deals = await storage.getTopDeals(60, 200);

      const publicDeals = deals
        .filter((d) =>
          d.titleStatus === "clean" &&
          (d.score.confidence ?? 0) >= 0.3 &&
          (d.score.savingsAmount ?? 0) > 500 &&
          d.price &&
          (!dealer || (d.dealerName ?? "").toLowerCase().includes(dealer.toLowerCase()))
        )
        .slice(0, limit)
        .map((d) => ({
          listingId: d.id,
          year: d.year,
          make: d.make,
          model: d.model,
          trim: d.trim,
          price: d.price,
          mileage: d.mileage,
          city: d.city,
          marketValueEst: d.score.marketValueEst,
          savingsAmount: d.score.savingsAmount ? Math.round(d.score.savingsAmount) : null,
          dealScore: d.score.dealScore,
          compCount: d.score.compCount,
          dealerName: d.dealerName,
          imageUrls: d.imageUrls,
          daysOnMarket: (d.score as any).daysOnMarket,
        }));

      res.json({ deals: publicDeals, market: "San Antonio, TX", total: publicDeals.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Buyer lead capture (the product you sell to dealers) ──
  app.post("/api/buyer-leads", async (req, res) => {
    try {
      const { name, phone, email, zipCode, timeline, vehicleInterest, consentTcpa, listingId, utmSource, utmCampaign, dealerTarget } = req.body;
      if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
      if (!consentTcpa) return res.status(400).json({ error: "Consent is required to receive deal alerts" });

      const lead = await storage.insertBuyerLead({
        listingId: listingId ? parseInt(listingId) : null,
        name: String(name).slice(0, 120),
        phone: String(phone).slice(0, 30),
        email: email ? String(email).slice(0, 200) : null,
        zipCode: zipCode ? String(zipCode).slice(0, 12) : null,
        timeline: timeline ?? null,
        vehicleInterest: vehicleInterest ? String(vehicleInterest).slice(0, 200) : null,
        consentTcpa: true,
        utmSource: utmSource ?? null,
        utmCampaign: utmCampaign ?? null,
        dealerTarget: dealerTarget ?? null,
      });

      res.json({ ok: true, leadId: lead.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Internal: view + manage buyer leads (deliver to dealer, track outcomes)
  app.get("/api/buyer-leads", async (req, res) => {
    try {
      const rows = await storage.getBuyerLeads(req.query.status as string | undefined);
      res.json({ leads: rows, total: rows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/buyer-leads/:id", async (req, res) => {
    try {
      const allowed = ["new", "delivered", "contacted", "appointment", "sold", "dead"];
      const { status } = req.body;
      if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      const lead = await storage.updateBuyerLeadStatus(parseInt(req.params.id), status);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json({ lead });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Appointments: the product you actually sell ──
  app.get("/api/appointments/slots", async (req, res) => {
    try {
      const dealer = (req.query.dealer as string) || null;
      const slots = await getAvailableSlots(dealer);
      res.json({ slots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct booking from the slot buttons — works with or without the AI.
  app.post("/api/appointments", async (req, res) => {
    try {
      const { buyerLeadId, listingId, dealerName, slotIso } = req.body ?? {};
      if (!buyerLeadId || !slotIso) return res.status(400).json({ error: "buyerLeadId and slotIso are required" });
      const lead = await storage.getBuyerLeadById(parseInt(buyerLeadId));
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const slots = await getAvailableSlots(dealerName ?? null);
      const valid = slots.find((s) => s.iso === slotIso);
      if (!valid) return res.status(409).json({ error: "That time is no longer available — pick another slot" });

      const listingIdParsed = listingId ? parseInt(listingId) : null;
      const scoreAtBooking = listingIdParsed ? await storage.getDealScoreForListing(listingIdParsed) : undefined;

      const appt = await storage.insertAppointment({
        buyerLeadId: lead.id,
        listingId: listingIdParsed,
        dealerName: dealerName ?? null,
        scheduledAt: new Date(slotIso),
        setBy: "slot_picker",
        dealScoreAtBooking: scoreAtBooking?.dealScore ?? null,
        scoreBreakdownAtBooking: scoreAtBooking?.scoreBreakdown ?? null,
        urgencyAtBooking: scoreAtBooking?.urgency ?? null,
      });

      // Confirmation SMS never blocks the booking response — the appointment
      // is already the source of truth once inserted above.
      const listing = appt.listingId ? await storage.getListingById(appt.listingId) : null;
      sendAppointmentConfirmation(appt, lead, listing ?? null).catch((err) =>
        console.error(`Confirmation SMS failed for appointment ${appt.id}:`, err.message)
      );
      notifyDealer(appt, lead, listing ?? null).catch((err) =>
        console.error(`Dealer notify failed for appointment ${appt.id}:`, err.message)
      );

      res.json({ appointment: appt, label: valid.label });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Internal: appointment book of record. shown / no_show is your billing evidence.
  // Query params: status, dealer, from (ISO), to (ISO) — all optional.
  app.get("/api/appointments", async (req, res) => {
    try {
      const { status, dealer, from, to } = req.query as Record<string, string | undefined>;
      const rows = await storage.getAppointments({
        status,
        dealerName: dealer,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      res.json({ appointments: rows, total: rows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const allowed = ["set", "confirmed", "shown", "no_show", "cancelled"];
      const { status, notes } = req.body ?? {};
      if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      const appt = await storage.updateAppointmentStatus(parseInt(req.params.id), status, notes);
      if (!appt) return res.status(404).json({ error: "Appointment not found" });
      res.json({ appointment: appt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── AI setter chat: one turn per call; the UI holds the history ──
  app.post("/api/chat/setter", async (req, res) => {
    try {
      const { buyerLeadId, deal, history, message } = req.body ?? {};
      if (!buyerLeadId || !message) return res.status(400).json({ error: "buyerLeadId and message are required" });
      if (String(message).length > 1000) return res.status(400).json({ error: "Message too long" });

      const result = await runSetterTurn({
        buyerLeadId: parseInt(buyerLeadId),
        deal: (deal ?? null) as SetterDealContext | null,
        history: Array.isArray(history) ? history.slice(-12) : [],
        userMessage: String(message),
      });

      // AI setter books through the same appointments table as the slot
      // picker — send the same confirmation + dealer notification, non-blocking.
      if (result.booked && result.appointmentId) {
        storage.getAppointmentById(result.appointmentId).then((full) => {
          if (full?.buyerLead) {
            sendAppointmentConfirmation(full, full.buyerLead, full.listing ?? null).catch((err) =>
              console.error(`Confirmation SMS failed for appointment ${result.appointmentId}:`, err.message)
            );
            notifyDealer(full, full.buyerLead, full.listing ?? null).catch((err) =>
              console.error(`Dealer notify failed for appointment ${result.appointmentId}:`, err.message)
            );
          }
        }).catch((err) => console.error(`Lookup failed for appointment ${result.appointmentId}:`, err.message));
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Dealer inventory import ──
  // Body: { csv: "<raw csv text>" } OR { rows: [ {...}, ... ] }
  // Optional: dealerName, city, state defaults applied to every row.
  // Automatically re-scores the full market after import.
  app.post("/api/jobs/import", async (req, res) => {
    try {
      const { csv, rows, dealerName, city, state } = req.body ?? {};
      let rawRows: Record<string, any>[] = [];

      if (typeof csv === "string" && csv.trim()) {
        rawRows = parseCsv(csv);
        if (rawRows.length === 0) {
          return res.status(400).json({ error: "CSV parsed to zero data rows — check that the first line is a header row" });
        }
      } else if (Array.isArray(rows) && rows.length > 0) {
        rawRows = rows;
      } else {
        return res.status(400).json({ error: "Provide either { csv: \"...\" } or { rows: [...] }" });
      }

      if (rawRows.length > 5000) {
        return res.status(400).json({ error: "Max 5,000 rows per import — split larger feeds" });
      }

      const defaults = { dealerName, city, state };
      const mapped: any[] = [];
      const skipped: { row: number; reason: string }[] = [];

      rawRows.forEach((r, idx) => {
        const result = mapDealerRow(r as Record<string, string>, defaults);
        if (result.skipped) {
          skipped.push({ row: idx + 2, reason: result.skipped }); // +2: 1-index + header line
        } else {
          mapped.push(result.raw);
        }
      });

      if (mapped.length === 0) {
        return res.status(400).json({
          error: "No importable rows — every row was missing year/make/model or price/VIN",
          skipped: skipped.slice(0, 20),
        });
      }

      const sourceName = (dealerName ? String(dealerName) : "dealer_import")
        .toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
      const ingest = await runIngestion(mapped, sourceName);
      const scoring = await runScoring();

      res.json({
        status: "completed",
        imported: ingest.processed,
        skipped: skipped.length,
        skippedDetails: skipped.slice(0, 20),
        rescored: scoring.scored,
        errors: [...ingest.errors, ...scoring.errors].slice(0, 20),
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

  // ── Live multi-source listing ingestion (licensed data, no scraping) ──
  // Deliberately manual/cron-triggered rather than auto-scheduled — every
  // call spends against a paid MarketCheck quota. Point an external
  // cron/scheduler at this on whatever cadence the budget allows.
  // Optional body overrides: { make, model, radiusMiles }.
  app.post("/api/jobs/ingest-live", async (req, res) => {
    try {
      if (!isMarketCheckConfigured()) {
        return res.status(400).json({
          error: "MARKETCHECK_API_KEY not set — sign up for a licensed data account (e.g. MarketCheck) and set the key to enable live ingestion.",
        });
      }
      const { make, model, radiusMiles } = req.body ?? {};
      const override: Partial<{ make: string; model: string; radiusMiles: number }> = {};
      if (make) override.make = make;
      if (model) override.model = model;
      if (radiusMiles) override.radiusMiles = parseInt(radiusMiles, 10);
      const result = await runLiveIngestion(override);
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

  // ── SMS: day-before reminder sweep ──
  // Also fires on a timer from index.ts; exposed here so an external cron
  // (or manual testing) can trigger it on demand. Idempotent — only picks up
  // appointments whose reminderSmsStatus is still "pending".
  app.post("/api/jobs/send-reminders", async (_req, res) => {
    try {
      const result = await runReminderSweep();
      res.json({ status: "completed", ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── SMS: Twilio inbound webhook (STOP/START/HELP compliance) ──
  // Configure this URL as the Messaging Service's inbound webhook in Twilio.
  // Twilio posts form-encoded { From, Body, ... }.
  app.post("/api/sms/inbound", async (req, res) => {
    try {
      const from = String(req.body?.From ?? "");
      const body = String(req.body?.Body ?? "");
      const twiml = await handleInboundSms(from, body);
      res.type("text/xml").send(twiml);
    } catch (err: any) {
      res.status(500).type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }
  });

  // ── Outcome feedback loop: won/lost + shown/no-show vs snapshotted scores ──
  // Read-only, computed on demand — cheap aggregation over existing data,
  // no external calls. Advisory report only; never mutates scoring.ts.
  app.get("/api/analytics/calibration", async (_req, res) => {
    try {
      const report = await runCalibrationAnalysis();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
