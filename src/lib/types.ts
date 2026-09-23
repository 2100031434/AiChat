export type RequestType = "text" | "pdf";
export type UsageStatus = "success" | "error";

export interface ModelPricing {
  model_id: string;
  display_name: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  active: boolean;
}

export interface UsageLog {
  id: string;
  created_at: string;
  model_id: string;
  request_type: RequestType;
  status: UsageStatus;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number | null;
  input_preview: string | null;
  output_preview: string | null;
  error_message: string | null;
}

export interface UsageSummaryRow {
  model_id: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

export interface ProcessResult {
  output: string;
  usage: {
    model_id: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
    latency_ms: number;
  };
}
