import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { UsageLog, UsageSummaryRow } from "@/lib/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const supabase = getSupabaseAdmin();

  const [logsRes, summaryRes] = await Promise.all([
    supabase
      .from("usage_logs")
      .select(
        "id, created_at, model_id, request_type, status, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, input_preview, output_preview, error_message",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from("usage_summary")
      .select("model_id, request_count, total_input_tokens, total_output_tokens, total_tokens, total_cost_usd"),
  ]);

  if (logsRes.error) {
    return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
  }
  if (summaryRes.error) {
    return NextResponse.json({ error: summaryRes.error.message }, { status: 500 });
  }

  const summary = (summaryRes.data ?? []) as UsageSummaryRow[];
  const totals = summary.reduce(
    (acc, row) => ({
      request_count: acc.request_count + row.request_count,
      total_tokens: acc.total_tokens + row.total_tokens,
      total_cost_usd: acc.total_cost_usd + row.total_cost_usd,
    }),
    { request_count: 0, total_tokens: 0, total_cost_usd: 0 },
  );

  return NextResponse.json({
    logs: (logsRes.data ?? []) as UsageLog[],
    total: logsRes.count ?? 0,
    summary,
    totals,
  });
}
