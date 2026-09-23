# LLM Usage Tracker

A small Next.js app that sends text and/or PDF uploads to Claude for
processing, and logs the model, token counts, and estimated cost of every
request to Supabase. Includes a dashboard for usage history and spend by
model.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS) — deployed on Vercel
- **Supabase** (Postgres) — stores the model price list and per-request usage
  logs
- **`@anthropic-ai/sdk`** — calls the Claude Messages API (text + PDF
  document input)

## How it works

- `POST /api/process` accepts `multipart/form-data` (`model`, `instruction`,
  `text`, `file`), calls Claude, computes cost from the model's price row,
  and inserts a row into `usage_logs`, tagged with whoever ran it (see
  Access control below).
- `model_pricing` is a database table, not a hardcoded list — **add a new
  model by inserting a row**, no code changes or redeploy required. The
  model picker and cost calculation both read from it live.
- `/dashboard` ("My usage" unless you're the admin) reads `usage_logs` to
  show total requests/tokens/cost, cost by model, and a recent-requests
  table, scoped to whoever is looking at it.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then open the SQL
editor and run `supabase/schema.sql`. This creates `model_pricing`,
`usage_logs`, and `app_users` (registered accounts), the `usage_summary`
view, and seeds pricing for Claude Opus 5, Claude Sonnet 5, and Claude
Haiku 4.5.

**Already have this schema installed?** Re-run `supabase/schema.sql` — every
statement in it is idempotent (`create table if not exists`, `add column if
not exists`, etc.), so it's safe to run again on top of an older install to
pick up:

- the `success_count`/`error_count` split on `usage_summary`, so the
  dashboard's "Total requests" stat counts every attempt instead of
  silently excluding failed ones;
- `app_users`, plus `usage_logs.user_id`/`usage_logs.guest_id`, needed for
  per-guest/per-account login (see Access control below). Requests logged
  before this migration have both columns `null` and won't show up in
  anyone's personal "My usage" view — only in the admin's global one.

To add another model later, just insert a row:

```sql
insert into model_pricing (model_id, display_name, input_price_per_mtok, output_price_per_mtok)
values ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 3.00, 15.00);
```

Set `active = false` on a row to hide it from the picker without deleting
history that references it.

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable                    | Where to find it                                      |
| ---------------------------- | ------------------------------------------------------ |
| `ANTHROPIC_API_KEY`          | [platform.claude.com](https://platform.claude.com) API keys |
| `SUPABASE_URL`                | Supabase project → Settings → API → Project URL       |
| `SUPABASE_SERVICE_ROLE_KEY`  | Supabase project → Settings → API → `service_role` secret |
| `SESSION_SECRET`             | Any long random string, e.g. `openssl rand -hex 32` — signs the login cookie (see below) |
| `APP_ADMIN_USERNAME` / `APP_ADMIN_PASSWORD` | Credentials you choose for the one account that can see everyone's usage |

The service-role key is used **only** in server-side route handlers/lib
files (marked with `import "server-only"`) — it is never sent to the
browser. Row Level Security is enabled on all three tables with no
policies, so the service-role key is the only one that can read or write
them.

### Access control

The home page (`/`) and the model list are open to everyone — no login
wall. Two things do require an identity, because they either spend your
Anthropic budget or expose request/response text:

- **Running a request** (`POST /api/process`) — clicking "Run" with no
  session redirects to `/login`, which offers "Continue as a guest" (an
  anonymous cookie, no password) or logging into an account.
- **Viewing usage** (`/dashboard`, `GET /api/usage`) — scoped to whoever's
  looking: a guest or account only ever sees their own requests. The one
  exception is the admin login (`APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD`),
  which sees every guest's and every account's usage in one place — that's
  the same env-configured credential pair from before, just checked inside
  the app's own login form now instead of via a browser Basic Auth prompt.
  It isn't a database row.

Accounts (`app_users`) are self-serve via `/signup` — a username and a
password (hashed with scrypt, never stored in plaintext) — and exist mainly
so usage history can follow you across devices/browsers; a guest's cookie
doesn't. There's no password reset flow.

**Set `SESSION_SECRET`, `APP_ADMIN_USERNAME`, and `APP_ADMIN_PASSWORD`
before deploying** — in production, signup/login/guest and the admin login
all fail closed (they refuse to issue a session) if these aren't set,
rather than falling back to an insecure default. Locally, `next dev` uses a
fixed dev-only session secret and `admin`/`admin` if you don't set them.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to process text/PDFs,
and [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for
usage history.

### 4. Deploy to Vercel

```bash
vercel
```

Add the same environment variables — including `SESSION_SECRET` and the
`APP_ADMIN_*` pair — in the Vercel project settings (Production and
Preview). No other configuration is needed — `next.config.ts` is unchanged
from the default.

## Limits

- **PDF size:** capped at 4MB in the app (`MAX_PDF_BYTES` in
  `src/app/api/process/route.ts` and `src/components/ProcessForm.tsx`).
  Vercel serverless functions have a request body limit well under Claude's
  own 32MB document limit, so this is set conservatively. Claude also caps
  PDFs at 600 pages (100 for 200k-context models).
- **Response length:** capped at 4096 output tokens per request
  (`MAX_OUTPUT_TOKENS` in `src/lib/anthropic.ts`) and a 55s request timeout,
  with `maxDuration = 60` on the route so it fits inside a typical
  serverless function timeout.
- Requests are non-streaming — the full result and its usage stats return
  together once the model finishes.

## Project structure

```
src/
  app/
    page.tsx                # process form (home) — open to everyone
    login/page.tsx           # guest / account login
    signup/page.tsx           # account creation
    dashboard/page.tsx         # usage dashboard — "My usage", or global for admin
    api/
      process/route.ts       # runs a request, logs usage (requires a session)
      usage/route.ts          # usage history + summary, JSON (requires a session)
      models/route.ts         # active models (JSON, open)
      auth/
        guest/route.ts        # starts an anonymous guest session
        signup/route.ts        # creates an account
        login/route.ts          # logs into an account or the admin login
        logout/route.ts          # clears the session cookie
  components/                # ProcessForm, Nav, dashboard widgets
  lib/
    anthropic.ts              # Claude client + request builder
    auth.ts                    # session signing, password hashing, identity
    supabase.ts                # server-only Supabase admin client
    pricing.ts                  # model lookup + cost calculation
    usage.ts                     # dashboard data fetching, scoped by identity
    types.ts, format.ts, theme.ts
supabase/schema.sql            # database schema + seed pricing
```
