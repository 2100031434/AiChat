import { NextResponse } from "next/server";
import { runExtraction } from "@/lib/anthropic";
import { calculateCost, getModelPricing } from "@/lib/pricing";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProcessResult, RequestType } from "@/lib/types";

// Give large PDFs room to run without hitting the default function timeout.
export const maxDuration = 60;

const DEFAULT_INSTRUCTION =
  "Extract and summarize the key information from the provided input.";
// Vercel serverless functions cap request bodies well below Claude's own
// 32MB document limit — reject early with a clear message instead of a
// generic platform 413.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const PREVIEW_LENGTH = 500;

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const modelId = String(formData.get("model") ?? "").trim();
  const instruction =
    String(formData.get("instruction") ?? "").trim() || DEFAULT_INSTRUCTION;
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!modelId) {
    return NextResponse.json({ error: "A model must be selected." }, { status: 400 });
  }
  if (!text && !hasFile) {
    return NextResponse.json(
      { error: "Provide text, a PDF file, or both." },
      { status: 400 },
    );
  }

  const pricing = await getModelPricing(modelId);
  if (!pricing || !pricing.active) {
    return NextResponse.json({ error: `Unknown or inactive model: ${modelId}` }, { status: 400 });
  }

  let pdfBase64: string | undefined;
  if (hasFile) {
    const pdfFile = file as File;
    if (pdfFile.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }
    if (pdfFile.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: `PDF too large — limit is ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.` },
        { status: 413 },
      );
    }
    const bytes = Buffer.from(await pdfFile.arrayBuffer());
    pdfBase64 = bytes.toString("base64");
  }

  const requestType: RequestType = hasFile ? "pdf" : "text";
  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  try {
    const result = await runExtraction({ modelId, instruction, text, pdfBase64 });
    const latencyMs = Date.now() - startedAt;
    const costUsd = calculateCost(result.inputTokens, result.outputTokens, pricing);

    const { error: insertError } = await supabase.from("usage_logs").insert({
      model_id: modelId,
      request_type: requestType,
      status: "success",
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      input_preview: truncate(text || `[PDF: ${(file as File).name}]`, PREVIEW_LENGTH),
      output_preview: truncate(result.outputText, PREVIEW_LENGTH),
    });
    if (insertError) {
      console.error("Failed to record usage log:", insertError.message);
    }

    const payload: ProcessResult = {
      output: result.outputText,
      usage: {
        model_id: modelId,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        total_tokens: result.inputTokens + result.outputTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error calling the model.";

    const { error: insertError } = await supabase.from("usage_logs").insert({
      model_id: modelId,
      request_type: requestType,
      status: "error",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      input_preview: truncate(text || `[PDF: ${(file as File).name}]`, PREVIEW_LENGTH),
      error_message: truncate(message, PREVIEW_LENGTH),
    });
    if (insertError) {
      console.error("Failed to record usage log:", insertError.message);
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
