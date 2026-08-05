import raw from "@/data/ancira-south-park-nissan-suv-page-1.json";

export type AnciraSampleVehicle = (typeof raw.vehicles)[number];

export type RankedAnciraVehicle = AnciraSampleVehicle & {
  deal_score: number;
  score_breakdown: {
    value_gap_points: number;
    savings_points: number;
    conditional_offer_penalty: number;
  };
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Ranks the currently extracted sample using transparent, non-financing
 * signals. This is a simulation until all inventory pages are ingested.
 */
export function rankAnciraSample(): RankedAnciraVehicle[] {
  return [...raw.vehicles]
    .map((vehicle) => {
      const valueGapPoints = ((vehicle.msrp_minus_ancira_price ?? 0) / vehicle.msrp) * 100;
      const savingsPoints = ((vehicle.ancira_savings ?? 0) / vehicle.msrp) * 50;
      const conditionalOfferPenalty = (vehicle.customer_cash ?? 0) > 0 ? 4 : 0;
      const dealScore = valueGapPoints + savingsPoints - conditionalOfferPenalty;

      return {
        ...vehicle,
        deal_score: round(dealScore),
        score_breakdown: {
          value_gap_points: round(valueGapPoints),
          savings_points: round(savingsPoints),
          conditional_offer_penalty: conditionalOfferPenalty,
        },
      };
    })
    .sort((a, b) => b.deal_score - a.deal_score);
}

export function getAnciraSampleVehicle(stock: string): RankedAnciraVehicle | undefined {
  return rankAnciraSample().find((vehicle) => vehicle.stock_number === stock);
}

export function getAnciraSampleSource() {
  return raw.source;
}
