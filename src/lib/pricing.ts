import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ModelPricing } from "@/lib/types";

/** Active models, ordered for display in the model picker. */
export async function listActiveModels(): Promise<ModelPricing[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("model_pricing")
    .select("model_id, display_name, input_price_per_mtok, output_price_per_mtok, active")
    .eq("active", true)
    .order("input_price_per_mtok", { ascending: false });

  if (error) throw new Error(`Failed to load model pricing: ${error.message}`);
  return (data ?? []) as ModelPricing[];
}

export async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("model_pricing")
    .select("model_id, display_name, input_price_per_mtok, output_price_per_mtok, active")
    .eq("model_id", modelId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load pricing for ${modelId}: ${error.message}`);
  return (data as ModelPricing | null) ?? null;
}

/** USD cost for a request given token counts and $/1M-token rates. */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: Pick<ModelPricing, "input_price_per_mtok" | "output_price_per_mtok">,
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.input_price_per_mtok;
  const outputCost = (outputTokens / 1_000_000) * pricing.output_price_per_mtok;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
