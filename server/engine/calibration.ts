// Outcome feedback loop — Priority #5 from PROJECT_SESSION_LOG.md's Next
// Build Priorities: "use won/lost + shown/no-show data to calibrate scoring
// weights."
//
// IMPORTANT DESIGN DECISION: this is a diagnostic REPORT, not an auto-tuner.
// scoring.ts is a rule-based point allocator (fixed 0-40/0-15/0-15/0-10/0-10/
// 0-10 ranges), not a trained model with gradient-adjustable weights, and a
// young pilot will have a small number of outcomes. Silently reweighting the
// engine off a handful of won/lost or shown/no-show samples is exactly the
// kind of overconfident, self-reinforcing behavior the original audit called
// out (score inflation, confidence always shown green, padded velocity —
// see PROJECT_SESSION_LOG.md's baseline audit). So this module surfaces
// directional signal with explicit sample-size gates and hands the decision
// to a human, the same way the rest of this codebase treats confidence as
// something to disclose honestly rather than paper over.

import { storage } from "../storage";
import type { Lead, Appointment } from "@shared/schema";

// Below this many samples in EITHER group, a component is reported as
// "insufficient data" rather than given a directional read at all.
const MIN_SAMPLE_SIZE = 8;

// A gap smaller than this (as a fraction of the component's max points)
// isn't called out as noteworthy — it's within the range of what pilot-scale
// noise alone could produce.
const NOTEWORTHY_GAP_FRACTION = 0.15;

const COMPONENT_MAX: Record<string, number> = {
  priceAdvantage: 40,
  mileageAdvantage: 15,
  localDemand: 15,
  reliability: 10,
  sellerQuality: 10,
  priceDropSignal: 10,
  dealScore: 100,
};

const URGENCY_TIERS = ["act_now", "strong_lead", "negotiate", "monitor", "pass"] as const;

interface ComponentFinding {
  component: string;
  avgPositive: number | null;
  avgNegative: number | null;
  nPositive: number;
  nNegative: number;
  sufficientData: boolean;
  noteworthy: boolean;
  gap: number | null;
}

interface UrgencyFinding {
  tier: string;
  total: number;
  positiveCount: number;
  positiveRate: number | null;
  sufficientData: boolean;
}

interface OutcomeReport {
  label: string;
  positiveLabel: string;
  negativeLabel: string;
  nPositive: number;
  nNegative: number;
  componentFindings: ComponentFinding[];
  urgencyFindings: UrgencyFinding[];
  narrative: string[];
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildComponentFindings(
  positiveBreakdowns: (Record<string, number> | null)[],
  negativeBreakdowns: (Record<string, number> | null)[],
  positiveScores: (number | null)[],
  negativeScores: (number | null)[]
): ComponentFinding[] {
  const components = ["priceAdvantage", "mileageAdvantage", "localDemand", "reliability", "sellerQuality", "priceDropSignal"];
  const findings: ComponentFinding[] = [];

  for (const component of components) {
    const posVals = positiveBreakdowns.filter((b): b is Record<string, number> => b != null).map((b) => b[component]).filter((v) => v != null);
    const negVals = negativeBreakdowns.filter((b): b is Record<string, number> => b != null).map((b) => b[component]).filter((v) => v != null);
    const avgPositive = mean(posVals);
    const avgNegative = mean(negVals);
    const sufficientData = posVals.length >= MIN_SAMPLE_SIZE && negVals.length >= MIN_SAMPLE_SIZE;
    const gap = avgPositive != null && avgNegative != null ? avgPositive - avgNegative : null;
    const noteworthy = sufficientData && gap != null && Math.abs(gap) / COMPONENT_MAX[component] >= NOTEWORTHY_GAP_FRACTION;
    findings.push({ component, avgPositive, avgNegative, nPositive: posVals.length, nNegative: negVals.length, sufficientData, noteworthy, gap });
  }

  // Total dealScore as its own row — useful even when no single component stands out.
  const posScores = positiveScores.filter((v): v is number => v != null);
  const negScores = negativeScores.filter((v): v is number => v != null);
  const avgPositive = mean(posScores);
  const avgNegative = mean(negScores);
  const sufficientData = posScores.length >= MIN_SAMPLE_SIZE && negScores.length >= MIN_SAMPLE_SIZE;
  const gap = avgPositive != null && avgNegative != null ? avgPositive - avgNegative : null;
  const noteworthy = sufficientData && gap != null && Math.abs(gap) / COMPONENT_MAX.dealScore >= NOTEWORTHY_GAP_FRACTION;
  findings.push({ component: "dealScore", avgPositive, avgNegative, nPositive: posScores.length, nNegative: negScores.length, sufficientData, noteworthy, gap });

  return findings;
}

function buildUrgencyFindings(positiveTiers: (string | null)[], negativeTiers: (string | null)[]): UrgencyFinding[] {
  return URGENCY_TIERS.map((tier) => {
    const posCount = positiveTiers.filter((t) => t === tier).length;
    const negCount = negativeTiers.filter((t) => t === tier).length;
    const total = posCount + negCount;
    const positiveRate = total > 0 ? posCount / total : null;
    return {
      tier,
      total,
      positiveCount: posCount,
      positiveRate,
      sufficientData: total >= MIN_SAMPLE_SIZE,
    };
  });
}

function buildNarrative(report: Omit<OutcomeReport, "narrative">): string[] {
  const lines: string[] = [];

  if (report.nPositive < MIN_SAMPLE_SIZE || report.nNegative < MIN_SAMPLE_SIZE) {
    lines.push(
      `Only ${report.nPositive} ${report.positiveLabel} and ${report.nNegative} ${report.negativeLabel} recorded so far — too few to draw any conclusions yet. Treat everything below as provisional until both groups reach at least ${MIN_SAMPLE_SIZE}.`
    );
  }

  const noteworthy = report.componentFindings.filter((f) => f.noteworthy);
  if (noteworthy.length === 0) {
    lines.push("No score component shows a gap large enough to act on yet.");
  } else {
    for (const f of noteworthy) {
      const direction = (f.gap ?? 0) > 0 ? "higher" : "lower";
      lines.push(
        `${f.component}: ${report.positiveLabel} averaged ${f.avgPositive?.toFixed(1)} vs ${f.avgNegative?.toFixed(1)} for ${report.negativeLabel} (n=${f.nPositive}/${f.nNegative}) — ${report.positiveLabel} ran ${direction}. Worth investigating whether this component is under- or over-weighted, but this is a descriptive comparison, not a statistical test.`
      );
    }
  }

  const tierWithSignal = report.urgencyFindings.filter((t) => t.sufficientData && t.positiveRate != null);
  for (const t of tierWithSignal) {
    lines.push(`Urgency tier "${t.tier}": ${(t.positiveRate! * 100).toFixed(0)}% ${report.positiveLabel} rate over ${t.total} outcomes.`);
  }

  return lines;
}

export interface CalibrationReport {
  generatedAt: string;
  leadOutcomes: OutcomeReport;
  appointmentOutcomes: OutcomeReport;
  minSampleSize: number;
  disclaimer: string;
}

export async function runCalibrationAnalysis(): Promise<CalibrationReport> {
  const job = await storage.insertJobRun("calibration_analysis");
  let recordsProcessed = 0;
  const errors: string[] = [];

  let leadOutcomes: OutcomeReport;
  let appointmentOutcomes: OutcomeReport;

  try {
    const leadsWithOutcomes: Lead[] = await storage.getLeadsWithOutcomes();
    const won = leadsWithOutcomes.filter((l) => l.status === "won");
    const lost = leadsWithOutcomes.filter((l) => l.status === "lost");
    recordsProcessed += leadsWithOutcomes.length;

    const leadComponentFindings = buildComponentFindings(
      won.map((l) => l.scoreBreakdownAtSave ?? null),
      lost.map((l) => l.scoreBreakdownAtSave ?? null),
      won.map((l) => l.scoreAtSave),
      lost.map((l) => l.scoreAtSave)
    );
    const leadUrgencyFindings = buildUrgencyFindings(
      won.map((l) => l.urgencyAtSave),
      lost.map((l) => l.urgencyAtSave)
    );
    const leadBase = {
      label: "Acquisition leads (won vs lost)",
      positiveLabel: "won",
      negativeLabel: "lost",
      nPositive: won.length,
      nNegative: lost.length,
      componentFindings: leadComponentFindings,
      urgencyFindings: leadUrgencyFindings,
    };
    leadOutcomes = { ...leadBase, narrative: buildNarrative(leadBase) };

    const appointmentsWithOutcomes: Appointment[] = await storage.getAppointmentsWithOutcomes();
    const shown = appointmentsWithOutcomes.filter((a) => a.status === "shown");
    const noShow = appointmentsWithOutcomes.filter((a) => a.status === "no_show");
    recordsProcessed += appointmentsWithOutcomes.length;

    const apptComponentFindings = buildComponentFindings(
      shown.map((a) => a.scoreBreakdownAtBooking ?? null),
      noShow.map((a) => a.scoreBreakdownAtBooking ?? null),
      shown.map((a) => a.dealScoreAtBooking),
      noShow.map((a) => a.dealScoreAtBooking)
    );
    const apptUrgencyFindings = buildUrgencyFindings(
      shown.map((a) => a.urgencyAtBooking),
      noShow.map((a) => a.urgencyAtBooking)
    );
    const apptBase = {
      label: "Appointments (shown vs no-show)",
      positiveLabel: "shown",
      negativeLabel: "no-show",
      nPositive: shown.length,
      nNegative: noShow.length,
      componentFindings: apptComponentFindings,
      urgencyFindings: apptUrgencyFindings,
    };
    appointmentOutcomes = { ...apptBase, narrative: buildNarrative(apptBase) };
  } catch (err: any) {
    errors.push(err.message);
    await storage.completeJobRun(job.id, recordsProcessed, errors);
    throw err;
  }

  await storage.completeJobRun(job.id, recordsProcessed, errors);

  return {
    generatedAt: new Date().toISOString(),
    leadOutcomes,
    appointmentOutcomes,
    minSampleSize: MIN_SAMPLE_SIZE,
    disclaimer:
      "This report describes correlations in your own outcome data — it does not run a statistical significance test and it never changes scoring.ts on its own. Use it to decide, as a human, whether a component's point allocation deserves a second look.",
  };
}
