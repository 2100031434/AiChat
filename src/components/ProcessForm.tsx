"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { formatCost, formatTokens } from "@/lib/format";
import type { ModelPricing, ProcessResult } from "@/lib/types";

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const DEFAULT_INSTRUCTION_PLACEHOLDER =
  "Extract and summarize the key information from the provided input.";

export function ProcessForm({ models }: { models: ModelPricing[] }) {
  const router = useRouter();
  const [modelId, setModelId] = useState(models[0]?.model_id ?? "");
  const [instruction, setInstruction] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = Boolean(modelId) && (text.trim().length > 0 || file !== null) && !loading;

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
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

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter (or any IME composition) inserts a newline —
    // matches the convention of Claude's own message composer.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
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

      if (res.status === 401) {
        router.push("/login?next=/");
        return;
      }

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

  const selectedModel = models.find((m) => m.model_id === modelId);
  const hasResult = Boolean(result);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-3xl flex-col px-6">
      <div className={hasResult ? "flex-1 space-y-6 py-10" : "flex flex-1 flex-col justify-center"}>
        {!hasResult && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-[32px] sm:leading-10">
              Process text or a PDF
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Send text and/or a PDF to Claude for extraction or analysis. Every request is
              logged with model, token counts, and estimated cost.
            </p>
          </div>
        )}

        {hasResult && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="eyebrow mb-2">Result</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{result!.output}</p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="eyebrow mb-3">Request usage</h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatItem label="Model" value={result!.usage.model_id} mono={false} />
                <StatItem label="Input tokens" value={formatTokens(result!.usage.input_tokens)} />
                <StatItem
                  label="Output tokens"
                  value={formatTokens(result!.usage.output_tokens)}
                />
                <StatItem label="Total tokens" value={formatTokens(result!.usage.total_tokens)} />
                <StatItem label="Cost" value={formatCost(result!.usage.cost_usd)} />
              </dl>
            </div>
          </div>
        )}

        {/* Composer — laid out like Claude.ai's own message box: a single
            rounded surface with the text field on top and a toolbar (attach,
            model picker, send) along the bottom edge, rather than a
            top-to-bottom stack of separately-labeled fields. */}
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_1px_1px_rgba(0,0,0,0.04),0_8px_16px_-4px_rgba(0,0,0,0.04)]">
            {showInstruction ? (
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={DEFAULT_INSTRUCTION_PLACEHOLDER}
                className="mb-2 w-full border-b border-[var(--border)] bg-transparent px-1 pb-2 text-xs text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowInstruction(true)}
                className="eyebrow mb-2 px-1 text-left hover:text-[var(--text-primary)]"
              >
                + Add instructions (optional)
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                autoGrow(e.target);
              }}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Paste or type text to process…"
              className="block max-h-80 w-full resize-none bg-transparent px-1 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-[var(--text-muted)]"
            />

            {file && (
              <div className="mb-1 mt-1 flex w-fit items-center gap-2 rounded-md bg-[var(--gridline)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                <span>
                  {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  aria-label="Remove attached file"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  ×
                </button>
              </div>
            )}

            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={onFileChange}
                  className="hidden"
                  aria-label="PDF upload (optional, max 4MB)"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach a PDF (max 4MB)"
                  aria-label="Attach a PDF"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--gridline)] hover:text-[var(--text-primary)]"
                >
                  <PaperclipIcon />
                </button>

                <div className="relative">
                  <select
                    id="model"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    aria-label="Model"
                    className="h-8 max-w-[11rem] cursor-pointer appearance-none truncate rounded-full border border-[var(--border)] bg-transparent py-0 pl-3 pr-7 text-xs font-medium text-[var(--text-primary)] outline-none hover:bg-[var(--gridline)] sm:max-w-none"
                  >
                    {models.map((m) => (
                      <option key={m.model_id} value={m.model_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                aria-label={loading ? "Processing" : "Run"}
                title={loading ? "Processing…" : "Run"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--on-primary)] transition-opacity disabled:opacity-30"
              >
                {loading ? <SpinnerIcon /> : <ArrowUpIcon />}
              </button>
            </div>
          </div>

          {selectedModel && (
            <p className="mt-2 px-1 text-center text-xs text-[var(--text-muted)]">
              {selectedModel.display_name} — ${selectedModel.input_price_per_mtok.toFixed(2)}/M in,
              ${selectedModel.output_price_per_mtok.toFixed(2)}/M out
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-[var(--critical)]/30 bg-[var(--critical)]/10 px-3 py-2 text-sm text-[var(--critical)]">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function StatItem({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 text-sm font-medium text-[var(--text-primary)] ${mono ? "tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.67 3.67 0 015.19 5.19l-9.2 9.19a1.83 1.83 0 01-2.6-2.6l8.49-8.48"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
