import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ModelPricing, UsageLog, UsageSummaryRow } from "@/lib/types";

export interface DashboardData {
  logs: UsageLog[];
  summary: UsageSummaryRow[];
  models: Pick<ModelPricing, "model_id" | "display_name">[];
  totals: { request_count: number; total_tokens: number; total_cost_usd: number };
}

export async function getDashboardData(logLimit = 50): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  const [logsRes, summaryRes, modelsRes] = await Promise.all([
    supabase
      .from("usage_logs")
      .select(
        "id, created_at, model_id, request_type, status, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, input_preview, output_preview, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(logLimit),
    supabase
      .from("usage_summary")
      .select(
        "model_id, request_count, total_input_tokens, total_output_tokens, total_tokens, total_cost_usd",
      ),
    supabase.from("model_pricing").select("model_id, display_name").order("model_id"),
  ]);

  if (logsRes.error) throw new Error(logsRes.error.message);
  if (summaryRes.error) throw new Error(summaryRes.error.message);
  if (modelsRes.error) throw new Error(modelsRes.error.message);

  const summary = (summaryRes.data ?? []) as UsageSummaryRow[];
  const totals = summary.reduce(
    (acc, row) => ({
      request_count: acc.request_count + row.request_count,
      total_tokens: acc.total_tokens + row.total_tokens,
      total_cost_usd: acc.total_cost_usd + row.total_cost_usd,
    }),
    { request_count: 0, total_tokens: 0, total_cost_usd: 0 },
  );

  return {
    logs: (logsRes.data ?? []) as UsageLog[],
    summary,
    models: (modelsRes.data ?? []) as Pick<ModelPricing, "model_id" | "display_name">[],
    totals,
  };
}
