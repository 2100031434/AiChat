import { formatCost, formatDateTime, formatTokens } from "@/lib/format";
import { STATUS_COLORS } from "@/lib/theme";
import type { UsageLog } from "@/lib/types";

export function UsageTable({ logs }: { logs: UsageLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No requests logged yet — process some text or a PDF to populate this table.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="eyebrow py-2 pr-4 text-left font-medium">Time</th>
            <th className="eyebrow py-2 pr-4 text-left font-medium">Model</th>
            <th className="eyebrow py-2 pr-4 text-left font-medium">Type</th>
            <th className="eyebrow py-2 pr-4 text-right font-medium">Input</th>
            <th className="eyebrow py-2 pr-4 text-right font-medium">Output</th>
            <th className="eyebrow py-2 pr-4 text-right font-medium">Total</th>
            <th className="eyebrow py-2 pr-4 text-right font-medium">Cost</th>
            <th className="eyebrow py-2 pr-4 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-[var(--border)] last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap text-[var(--text-secondary)]">
                {formatDateTime(log.created_at)}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-[var(--text-primary)]">
                {log.model_id}
              </td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{log.request_type}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatTokens(log.input_tokens)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatTokens(log.output_tokens)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatTokens(log.total_tokens)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{formatCost(log.cost_usd)}</td>
              <td className="py-2 pr-4">
                <StatusBadge status={log.status} title={log.error_message ?? undefined} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status, title }: { status: string; title?: string }) {
  const color = status === "success" ? STATUS_COLORS.good : STATUS_COLORS.critical;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {status}
    </span>
  );
}
