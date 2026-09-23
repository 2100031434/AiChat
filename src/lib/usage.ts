import "server-only";
import type { Identity } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ModelPricing, UsageLog, UsageSummaryRow } from "@/lib/types";

export interface DashboardData {
  logs: UsageLog[];
  summary: UsageSummaryRow[];
  models: Pick<ModelPricing, "model_id" | "display_name">[];
  totals: {
    request_count: number;
    success_count: number;
    error_count: number;
    total_tokens: number;
    total_cost_usd: number;
  };
  scope: "admin" | "personal";
}

const LOG_COLUMNS =
  "id, created_at, model_id, request_type, status, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, input_preview, output_preview, error_message, user_id, guest_id";

// A personal (non-admin) view has no per-model rollup view to read from —
// usage_summary aggregates every user. Cap how many of a person's own rows
// get pulled down to compute it; nobody legitimate has anywhere near this
// many requests, and it keeps the query bounded.
export const PERSONAL_SUMMARY_ROW_CAP = 1000;

export function summarizeLogs(logs: UsageLog[]): UsageSummaryRow[] {
  const byModel = new Map<string, UsageSummaryRow>();
  for (const log of logs) {
    const row = byModel.get(log.model_id) ?? {
      model_id: log.model_id,
      request_count: 0,
      success_count: 0,
      error_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      total_cost_usd: 0,
    };
    row.request_count += 1;
    if (log.status === "success") {
      row.success_count += 1;
      row.total_input_tokens += log.input_tokens;
      row.total_output_tokens += log.output_tokens;
      row.total_tokens += log.total_tokens;
      row.total_cost_usd += log.cost_usd;
    } else {
      row.error_count += 1;
    }
    byModel.set(log.model_id, row);
  }
  return [...byModel.values()];
}

export function totalsFromSummary(summary: UsageSummaryRow[]): DashboardData["totals"] {
  return summary.reduce(
    (acc, row) => ({
      request_count: acc.request_count + row.request_count,
      success_count: acc.success_count + row.success_count,
      error_count: acc.error_count + row.error_count,
      total_tokens: acc.total_tokens + row.total_tokens,
      total_cost_usd: acc.total_cost_usd + row.total_cost_usd,
    }),
    { request_count: 0, success_count: 0, error_count: 0, total_tokens: 0, total_cost_usd: 0 },
  );
}

/**
 * Admin sees every request from every user/guest (the original global
 * dashboard). Everyone else only ever sees their own — scoped by user_id
 * for an account or guest_id for a guest — since usage_logs.input_preview/
 * output_preview hold real request/response text, not just metadata.
 */
export async function getDashboardData(
  identity: Identity,
  logLimit = 50,
): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  if (identity.kind === "admin") {
    const [logsRes, summaryRes, modelsRes] = await Promise.all([
      supabase
        .from("usage_logs")
        .select(LOG_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(logLimit),
      supabase
        .from("usage_summary")
        .select(
          "model_id, request_count, success_count, error_count, total_input_tokens, total_output_tokens, total_tokens, total_cost_usd",
        ),
      supabase.from("model_pricing").select("model_id, display_name").order("model_id"),
    ]);

    if (logsRes.error) throw new Error(logsRes.error.message);
    if (summaryRes.error) throw new Error(summaryRes.error.message);
    if (modelsRes.error) throw new Error(modelsRes.error.message);

    const summary = (summaryRes.data ?? []) as UsageSummaryRow[];
    return {
      logs: (logsRes.data ?? []) as UsageLog[],
      summary,
      models: (modelsRes.data ?? []) as Pick<ModelPricing, "model_id" | "display_name">[],
      totals: totalsFromSummary(summary),
      scope: "admin",
    };
  }

  const matchColumn = identity.kind === "user" ? "user_id" : "guest_id";
  const matchValue = identity.id;

  const [logsRes, modelsRes] = await Promise.all([
    supabase
      .from("usage_logs")
      .select(LOG_COLUMNS)
      .eq(matchColumn, matchValue)
      .order("created_at", { ascending: false })
      .limit(PERSONAL_SUMMARY_ROW_CAP),
    supabase.from("model_pricing").select("model_id, display_name").order("model_id"),
  ]);

  if (logsRes.error) throw new Error(logsRes.error.message);
  if (modelsRes.error) throw new Error(modelsRes.error.message);

  const logs = (logsRes.data ?? []) as UsageLog[];
  const summary = summarizeLogs(logs);

  return {
    logs: logs.slice(0, logLimit),
    summary,
    models: (modelsRes.data ?? []) as Pick<ModelPricing, "model_id" | "display_name">[],
    totals: totalsFromSummary(summary),
    scope: "personal",
  };
}
