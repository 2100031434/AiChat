import { CostByModelChart } from "@/components/CostByModelChart";
import { StatTile } from "@/components/StatTile";
import { UsageTable } from "@/components/UsageTable";
import { formatCost, formatTokens } from "@/lib/format";
import { getDashboardData } from "@/lib/usage";

// Usage changes on every request — always read fresh data.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data;
  let loadError: string | null = null;
  try {
    data = await getDashboardData(50);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load usage data.";
  }

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold">Couldn&apos;t load usage data</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{loadError}</p>
      </div>
    );
  }

  const { logs, summary, models, totals } = data;
  const modelsUsed = summary.filter((s) => s.request_count > 0).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Requests, tokens, and estimated spend across all models.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total requests" value={formatTokens(totals.request_count)} />
        <StatTile label="Total tokens" value={formatTokens(totals.total_tokens)} />
        <StatTile label="Total cost" value={formatCost(totals.total_cost_usd)} />
        <StatTile label="Models used" value={String(modelsUsed)} />
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">
          Cost by model
        </h2>
        <CostByModelChart
          summary={summary}
          modelOrder={models.map((m) => m.model_id)}
        />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">
          Recent requests
        </h2>
        <UsageTable logs={logs} />
      </section>
    </div>
  );
}
