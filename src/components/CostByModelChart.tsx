import { formatCost } from "@/lib/format";
import { seriesColor } from "@/lib/theme";
import type { UsageSummaryRow } from "@/lib/types";

/**
 * Horizontal bar chart, magnitude-by-category. Each bar is directly labeled
 * with its model name and cost, so identity never depends on color alone —
 * no separate legend needed. Hue slots are assigned by a fixed model order
 * (not by rank), so a model keeps its color as costs change between loads.
 */
export function CostByModelChart({
  summary,
  modelOrder,
}: {
  summary: UsageSummaryRow[];
  modelOrder: string[];
}) {
  const rows = summary.filter((r) => r.total_cost_usd > 0 || r.request_count > 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No usage yet — run a request to see cost by model.
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => r.total_cost_usd), 0.000001);
  const sorted = [...rows].sort((a, b) => b.total_cost_usd - a.total_cost_usd);

  return (
    <div className="space-y-3">
      {sorted.map((row) => {
        const colorIndex = modelOrder.indexOf(row.model_id);
        const color = seriesColor(colorIndex === -1 ? 0 : colorIndex);
        const widthPct = Math.max(2, (row.total_cost_usd / max) * 100);
        return (
          <div key={row.model_id} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-xs text-[var(--text-secondary)]">
              {row.model_id}
            </div>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--gridline)]/40">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
            <div className="w-24 shrink-0 text-right text-xs tabular-nums text-[var(--text-secondary)]">
              {formatCost(row.total_cost_usd)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
