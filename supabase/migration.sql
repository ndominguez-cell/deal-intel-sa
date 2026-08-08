-- SA Auto Match — live lead capture table schema
-- Project ref verified: ikdynmhgvwhfgunfeyae
--
-- This matches the existing production Supabase table that the deployed
-- /api/leads route writes to. The app maps the funnel payload to this schema:
--   name -> full_name
--   vehicle_type -> vehicle_interest
--   trade_year/make/model/mileage -> current_vehicle
--   has_trade_in -> has_trade
--   consent -> consent_sms
--   timeframe -> requested visit timing
--   utm_* + preferred_contact_window + submission_id -> utm jsonb
-- A failed ClickUp handoff is marked status = FOLLOW_UP_ERROR for reconciliation.

create extension if not exists "pgcrypto";

create table if not exists public.auto_leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  full_name         text,
  phone             text,
  email             text,
  vehicle_interest  text,
  current_vehicle   text,
  has_trade         boolean,
  down_payment      text,
  payment_target    text,
  credit_band       text, -- self-reported band only; NOT a credit decision or score
  timeframe         text,
  consent_sms       boolean,
  source            text,
  utm               jsonb,
  clickup_task_id   text,
  status            text default 'NEW'
);

create index if not exists auto_leads_created_at_idx
  on public.auto_leads (created_at desc);

create index if not exists auto_leads_status_idx
  on public.auto_leads (status);

-- Row Level Security: ON, with NO public policies.
-- With RLS enabled and no policies, anon/authenticated clients are denied.
-- Server-side code uses the service_role key, which bypasses RLS.
alter table public.auto_leads enable row level security;
alter table public.auto_leads force row level security;
