import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PERSONAL_SUMMARY_ROW_CAP, summarizeLogs, totalsFromSummary } from "@/lib/usage";
import type { UsageLog, UsageSummaryRow } from "@/lib/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const LOG_COLUMNS =
  "id, created_at, model_id, request_type, status, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, input_preview, output_preview, error_message, user_id, guest_id";

// Scoped the same way the dashboard page is: admin sees everyone, a guest
// or account only ever sees their own rows. This used to be a fully public,
// unauthenticated endpoint returning every request's raw text previews —
// see git history if you're wondering why identity is checked here at all.
export async function GET(request: Request) {
  const identity = await getIdentity();
  if (!identity) {
    return NextResponse.json(
      { error: "Continue as a guest or log in to view usage." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const supabase = getSupabaseAdmin();

  if (identity.kind === "admin") {
    const [logsRes, summaryRes] = await Promise.all([
      supabase
        .from("usage_logs")
        .select(LOG_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from("usage_summary")
        .select(
          "model_id, request_count, success_count, error_count, total_input_tokens, total_output_tokens, total_tokens, total_cost_usd",
        ),
    ]);

    if (logsRes.error) return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
    if (summaryRes.error) {
      return NextResponse.json({ error: summaryRes.error.message }, { status: 500 });
    }

    const summary = (summaryRes.data ?? []) as UsageSummaryRow[];
    return NextResponse.json({
      logs: (logsRes.data ?? []) as UsageLog[],
      total: logsRes.count ?? 0,
      summary,
      totals: totalsFromSummary(summary),
    });
  }

  const matchColumn = identity.kind === "user" ? "user_id" : "guest_id";
  const [logsRes, allRes] = await Promise.all([
    supabase
      .from("usage_logs")
      .select(LOG_COLUMNS, { count: "exact" })
      .eq(matchColumn, identity.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from("usage_logs")
      .select(LOG_COLUMNS)
      .eq(matchColumn, identity.id)
      .order("created_at", { ascending: false })
      .limit(PERSONAL_SUMMARY_ROW_CAP),
  ]);

  if (logsRes.error) return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
  if (allRes.error) return NextResponse.json({ error: allRes.error.message }, { status: 500 });

  const summary = summarizeLogs((allRes.data ?? []) as UsageLog[]);
  return NextResponse.json({
    logs: (logsRes.data ?? []) as UsageLog[],
    total: logsRes.count ?? 0,
    summary,
    totals: totalsFromSummary(summary),
  });
}
