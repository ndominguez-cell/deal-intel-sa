-- SA Auto Match — lead capture table
-- Run in the Supabase SQL editor (project: ngu-bid-platform).
-- Requires pgcrypto for gen_random_uuid() (enabled by default on Supabase).

create extension if not exists "pgcrypto";

create table if not exists public.auto_leads (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text,
  phone          text,
  email          text,
  vehicle_type   text,
  has_trade_in   boolean,
  trade_year     text,
  trade_make     text,
  trade_model    text,
  trade_mileage  text,
  payment_target text,
  down_payment   text,
  credit_band    text,   -- self-reported band only; NOT a credit decision or score
  timeframe      text,
  consent        boolean,
  source         text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text
);

-- Index for time-ordered reads (dashboards, recent-leads queries).
create index if not exists auto_leads_created_at_idx
  on public.auto_leads (created_at desc);

-- Row Level Security: ON, with NO policies.
-- With RLS enabled and no policies, the anon and authenticated roles are
-- fully denied. Only the service_role key (which bypasses RLS) can
-- read/write this table — i.e. server-side code using
-- SUPABASE_SERVICE_ROLE_KEY. Never expose that key to the client.
alter table public.auto_leads enable row level security;
alter table public.auto_leads force row level security;
