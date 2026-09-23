"use client";

import { useState, type FormEvent } from "react";
import { formatCost, formatTokens } from "@/lib/format";
import type { ModelPricing, ProcessResult } from "@/lib/types";

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const DEFAULT_INSTRUCTION_PLACEHOLDER =
  "Extract and summarize the key information from the provided input.";

export function ProcessForm({ models }: { models: ModelPricing[] }) {
  const [modelId, setModelId] = useState(models[0]?.model_id ?? "");
  const [instruction, setInstruction] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const canSubmit = Boolean(modelId) && (text.trim().length > 0 || file !== null) && !loading;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      setFile(null);
      e.target.value = "";
      return;
    }
    if (selected && selected.size > MAX_PDF_BYTES) {
      setError(
        `PDF is too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Limit is ${
          MAX_PDF_BYTES / 1024 / 1024
        }MB.`,
      );
      setFile(null);
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(selected);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.set("model", modelId);
      if (instruction.trim()) body.set("instruction", instruction.trim());
      if (text.trim()) body.set("text", text.trim());
      if (file) body.set("file", file);

      const res = await fetch("/api/process", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }
      setResult(data as ProcessResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Process text or a PDF</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Send text and/or a PDF to Claude for extraction or analysis. Every request is
          logged with model, token counts, and estimated cost.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <div>
          <label htmlFor="model" className="block text-sm font-medium mb-1.5">
            Model
          </label>
          <select
            id="model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            {models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.display_name} — ${m.input_price_per_mtok.toFixed(2)}/M in, $
                {m.output_price_per_mtok.toFixed(2)}/M out
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="instruction" className="block text-sm font-medium mb-1.5">
            Instruction <span className="text-[var(--text-muted)]">(optional)</span>
          </label>
          <input
            id="instruction"
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={DEFAULT_INSTRUCTION_PLACEHOLDER}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label htmlFor="text" className="block text-sm font-medium mb-1.5">
            Text input <span className="text-[var(--text-muted)]">(optional)</span>
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste text to process…"
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium mb-1.5">
            PDF upload <span className="text-[var(--text-muted)]">(optional, max 4MB)</span>
          </label>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            className="w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          {file && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-[var(--critical)]/30 bg-[var(--critical)]/10 px-3 py-2 text-sm text-[var(--critical)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          {loading ? "Processing…" : "Run"}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Result</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.output}</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
              Request usage
            </h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <StatItem label="Model" value={result.usage.model_id} mono={false} />
              <StatItem label="Input tokens" value={formatTokens(result.usage.input_tokens)} />
              <StatItem
                label="Output tokens"
                value={formatTokens(result.usage.output_tokens)}
              />
              <StatItem label="Total tokens" value={formatTokens(result.usage.total_tokens)} />
              <StatItem label="Cost" value={formatCost(result.usage.cost_usd)} />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${mono ? "tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}
