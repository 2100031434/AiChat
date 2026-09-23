import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export const MAX_OUTPUT_TOKENS = 4096;
// Keep the request well inside a typical serverless function timeout.
const REQUEST_TIMEOUT_MS = 55_000;

export interface RunExtractionInput {
  modelId: string;
  instruction: string;
  text?: string;
  pdfBase64?: string;
}

export interface RunExtractionResult {
  outputText: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

/**
 * Sends a single non-streaming extraction/analysis request to Claude and
 * returns the response text plus token usage for cost accounting.
 */
export async function runExtraction({
  modelId,
  instruction,
  text,
  pdfBase64,
}: RunExtractionInput): Promise<RunExtractionResult> {
  const content: Anthropic.Messages.ContentBlockParam[] = [];

  if (pdfBase64) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdfBase64,
      },
    });
  }

  const promptParts = [instruction.trim()];
  if (text && text.trim()) {
    promptParts.push(`Text to process:\n\n${text.trim()}`);
  }
  content.push({ type: "text", text: promptParts.join("\n\n") });

  const anthropic = getClient();
  const response = await anthropic.messages.create(
    {
      model: modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content }],
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );

  const outputText = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return {
    outputText:
      outputText ||
      (response.stop_reason === "refusal"
        ? "The model declined to process this request."
        : ""),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason,
  };
}
