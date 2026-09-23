-- LLM usage tracker schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists pgcrypto;

-- Model registry & pricing. Add a row here to support a new model — no code
-- changes required. Prices are USD per 1,000,000 tokens.
create table if not exists model_pricing (
  model_id             text primary key,
  display_name         text not null,
  input_price_per_mtok numeric(10, 4) not null,
  output_price_per_mtok numeric(10, 4) not null,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

-- One row per LLM request.
create table if not exists usage_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  model_id        text not null references model_pricing (model_id),
  request_type    text not null check (request_type in ('text', 'pdf')),
  status          text not null default 'success' check (status in ('success', 'error')),
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  total_tokens    integer generated always as (input_tokens + output_tokens) stored,
  cost_usd        numeric(12, 6) not null default 0,
  latency_ms      integer,
  input_preview   text,
  output_preview  text,
  error_message   text
);

create index if not exists usage_logs_created_at_idx on usage_logs (created_at desc);
create index if not exists usage_logs_model_id_idx on usage_logs (model_id);

-- Per-model rollup used by the dashboard.
create or replace view usage_summary as
select
  model_id,
  count(*) filter (where status = 'success') as request_count,
  coalesce(sum(input_tokens) filter (where status = 'success'), 0) as total_input_tokens,
  coalesce(sum(output_tokens) filter (where status = 'success'), 0) as total_output_tokens,
  coalesce(sum(total_tokens) filter (where status = 'success'), 0) as total_tokens,
  coalesce(sum(cost_usd) filter (where status = 'success'), 0) as total_cost_usd
from usage_logs
group by model_id;

-- The app talks to Supabase with the service-role key from server-only route
-- handlers, so RLS below is defense in depth (service role bypasses RLS; no
-- policies are defined, so anon/authenticated callers get nothing).
alter table model_pricing enable row level security;
alter table usage_logs enable row level security;

-- Seed the current model lineup. Prices are $/1M tokens (see Anthropic pricing).
insert into model_pricing (model_id, display_name, input_price_per_mtok, output_price_per_mtok)
values
  ('claude-opus-5', 'Claude Opus 5', 5.00, 25.00),
  ('claude-sonnet-5', 'Claude Sonnet 5', 3.00, 15.00),
  ('claude-haiku-4-5', 'Claude Haiku 4.5', 1.00, 5.00)
on conflict (model_id) do nothing;
