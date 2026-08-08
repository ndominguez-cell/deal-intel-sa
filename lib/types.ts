// SA Auto Match — shared lead contract.
// This type MUST match the canonical payload used by the funnel frontend,
// the /api/leads route, the Supabase `auto_leads` table, and the ClickUp
// lead sheet. Keep all consumers in sync with this shape.

export type Lead = {
  name: string;
  phone: string;
  email: string;

  vehicle_type: string;

  has_trade_in: boolean;
  trade_year: string;
  trade_make: string;
  trade_model: string;
  trade_mileage: string;

  timeframe: string;
  contact_window: string;
  submission_id: string;

  consent: boolean;

  source: string;

  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

// Field keys in canonical order — handy for row building / iteration.
export const LEAD_FIELDS: (keyof Lead)[] = [
  "name",
  "phone",
  "email",
  "vehicle_type",
  "has_trade_in",
  "trade_year",
  "trade_make",
  "trade_model",
  "trade_mileage",
  "timeframe",
  "contact_window",
  "submission_id",
  "consent",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];
