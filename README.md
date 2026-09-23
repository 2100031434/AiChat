# LLM Usage Tracker

A Next.js app that sends text and/or PDF uploads to Claude for processing,
then logs the model, token counts, and estimated cost of every request to
Supabase. Includes a dashboard for usage history and spend by model.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS) — deployed on Vercel
- **Supabase** (Postgres) — stores model pricing and per-request usage logs
- **`@anthropic-ai/sdk`** — calls the Claude Messages API (text + PDF input)

## How it works

- `POST /api/process` takes `multipart/form-data` (`model`, `instruction`,
  `text`, `file`), calls Claude, computes cost from the model's price row,
  and logs a row to `usage_logs` tagged with whoever ran it.
- `model_pricing` is a database table, not a hardcoded list — add a model by
  inserting a row, no code change or redeploy needed. The model picker and
  cost calculation both read it live.
- `/dashboard` shows total requests/tokens/cost, cost by model, and recent
  requests — "My usage" for a normal user, everyone's usage for the admin.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), open the SQL
editor, and run `supabase/schema.sql`. This creates `model_pricing`,
`usage_logs`, `app_users`, the `usage_summary` view, and seeds pricing for
Claude Opus 5, Sonnet 5, and Haiku 4.5.

Already have the schema installed? Re-running `supabase/schema.sql` is
safe — every statement is idempotent (`create table if not exists`, etc.)
— and picks up any new columns/views added since your last install.

Add another model anytime with:

```sql
insert into model_pricing (model_id, display_name, input_price_per_mtok, output_price_per_mtok)
values ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 3.00, 15.00);
```

Set `active = false` on a row to hide it from the picker without deleting
history that references it.

### 2. Set environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where to find it |
| --- | --- |
| `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) → API keys |
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API → `service_role` secret |
| `SESSION_SECRET` | Any long random string (e.g. `openssl rand -hex 32`) — signs the login cookie |
| `APP_ADMIN_USERNAME` / `APP_ADMIN_PASSWORD` | Credentials for the one account that can see everyone's usage |

The service-role key is only used server-side (files marked
`import "server-only"`) and never reaches the browser. All three tables
have Row Level Security enabled with no policies, so this key is the only
way to read or write them.

**Set all three of `SESSION_SECRET`, `APP_ADMIN_USERNAME`, and
`APP_ADMIN_PASSWORD` before deploying.** In production, login/signup/guest
sessions fail closed without them. Locally, `next dev` falls back to a
fixed dev-only secret and `admin`/`admin`.

### 3. Install and run

```bash
npm install
npm run dev
```

- [http://localhost:3000](http://localhost:3000) — process text/PDFs
- [http://localhost:3000/dashboard](http://localhost:3000/dashboard) — usage history

### 4. Deploy to Vercel

```bash
vercel
```

Add the same environment variables in the Vercel project settings
(Production and Preview). No other config needed.

## Access control

- **Home page (`/`) and model list** — open to everyone, no login required.
- **Running a request** (`POST /api/process`) — requires an identity, since
  it spends your Anthropic budget. Clicking "Run" without a session
  redirects to `/login`, which offers a guest session (anonymous cookie,
  no password) or an account login.
- **Viewing usage** (`/dashboard`, `GET /api/usage`) — scoped to whoever's
  looking. A guest or account only sees their own requests. The admin login
  (`APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD`) is the one exception and sees
  everything; it's a configured credential pair, not a database row.

Accounts (`app_users`) are self-serve via `/signup` — username + password,
hashed with scrypt — mainly so usage history follows you across devices.
There's no password reset flow.

## Limits

- **PDF size:** capped at 4MB (`MAX_PDF_BYTES`), well under Claude's 32MB
  document limit but within Vercel's request body limit. Claude also caps
  PDFs at 600 pages (100 for 200k-context models).
- **Response length:** capped at 4096 output tokens (`MAX_OUTPUT_TOKENS`),
  with a 55s request timeout and `maxDuration = 60` on the route.
- Requests are non-streaming — the result and usage stats return together
  once the model finishes.

## Project structure

```
src/
  app/
    page.tsx                  # process form (home) — open to everyone
    login/page.tsx            # guest / account login
    signup/page.tsx           # account creation
    dashboard/page.tsx        # usage dashboard
    api/
      process/route.ts        # runs a request, logs usage (session required)
      usage/route.ts          # usage history + summary, JSON (session required)
      models/route.ts         # active models, JSON (open)
      auth/
        guest/route.ts        # starts an anonymous guest session
        signup/route.ts       # creates an account
        login/route.ts        # logs into an account or the admin login
        logout/route.ts       # clears the session cookie
  components/                 # ProcessForm, Nav, dashboard widgets
  lib/
    anthropic.ts              # Claude client + request builder
    auth.ts                   # session signing, password hashing, identity
    supabase.ts               # server-only Supabase admin client
    pricing.ts                # model lookup + cost calculation
    usage.ts                  # dashboard data fetching, scoped by identity
    types.ts, format.ts, theme.ts
supabase/schema.sql            # database schema + seed pricing
```
