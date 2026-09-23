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
  and inserts a row into `usage_logs`.
- `model_pricing` is a database table, not a hardcoded list — **add a new
  model by inserting a row**, no code changes or redeploy required. The
  model picker and cost calculation both read from it live.
- `/dashboard` reads `usage_logs` and the `usage_summary` view to show
  total requests/tokens/cost, cost by model, and a recent-requests table.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then open the SQL
editor and run `supabase/schema.sql`. This creates `model_pricing` and
`usage_logs`, the `usage_summary` view, and seeds pricing for Claude Opus 5,
Claude Sonnet 5, and Claude Haiku 4.5.

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

The service-role key is used **only** in server-side route handlers/lib
files (marked with `import "server-only"`) — it is never sent to the
browser. Row Level Security is enabled on both tables with no policies, so
it's the only key that can read or write them.

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

Add the same three environment variables in the Vercel project settings
(Production and Preview). No other configuration is needed — `next.config.ts`
is unchanged from the default.

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
    page.tsx                # process form (home)
    dashboard/page.tsx       # usage dashboard
    api/
      process/route.ts       # runs a request, logs usage
      usage/route.ts          # usage history + summary (JSON)
      models/route.ts         # active models (JSON)
  components/                # ProcessForm, dashboard widgets
  lib/
    anthropic.ts              # Claude client + request builder
    supabase.ts                # server-only Supabase admin client
    pricing.ts                  # model lookup + cost calculation
    usage.ts                     # dashboard data fetching
    types.ts, format.ts, theme.ts
supabase/schema.sql            # database schema + seed pricing
```
