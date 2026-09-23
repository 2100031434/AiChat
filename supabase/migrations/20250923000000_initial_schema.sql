-- LLM usage tracker schema
-- Applied via `npx supabase db push` (or paste into the Supabase SQL editor
-- for a one-off manual install).

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

-- Registered accounts. Guests never get a row here — they're identified
-- only by the random id in their session cookie (see src/lib/auth.ts) — so
-- this table exists purely so a person can come back on another device.
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- One row per LLM request. Exactly one of user_id/guest_id is set for a
-- request made after accounts/guests shipped; both are null for requests
-- logged before that (there was no identity to attach).
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
  error_message   text,
  user_id         uuid references app_users (id) on delete set null,
  guest_id        text
);

-- Additive migration for installs from before accounts/guests existed —
-- `create table if not exists` above is a no-op once the table already
-- exists, so the new columns need adding separately.
alter table usage_logs add column if not exists user_id uuid references app_users (id) on delete set null;
alter table usage_logs add column if not exists guest_id text;

create index if not exists usage_logs_created_at_idx on usage_logs (created_at desc);
create index if not exists usage_logs_model_id_idx on usage_logs (model_id);
create index if not exists usage_logs_user_id_idx on usage_logs (user_id);
create index if not exists usage_logs_guest_id_idx on usage_logs (guest_id);

-- Per-model rollup used by the dashboard. request_count is every attempt
-- (success + error) so the dashboard's totals never disagree with what the
-- recent-requests table shows; success_count/error_count break that down.
-- Token/cost sums stay success-only since failed requests always log 0 for
-- both (see the route handler's error branch).
--
-- Dropped and recreated rather than `create or replace view`: Postgres only
-- allows `replace` to append columns at the end of the existing list, not
-- insert them in the middle — doing that here reads as renaming
-- total_input_tokens and errors with 42P16. Nothing references this view,
-- so dropping it is safe.
drop view if exists usage_summary;
create view usage_summary as
select
  model_id,
  count(*) as request_count,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'error') as error_count,
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
alter table app_users enable row level security;

-- Seed the current model lineup. Prices are $/1M tokens (see Anthropic pricing).
insert into model_pricing (model_id, display_name, input_price_per_mtok, output_price_per_mtok)
values
  ('claude-opus-5', 'Claude Opus 5', 5.00, 25.00),
  ('claude-sonnet-5', 'Claude Sonnet 5', 3.00, 15.00),
  ('claude-haiku-4-5', 'Claude Haiku 4.5', 1.00, 5.00)
on conflict (model_id) do nothing;
