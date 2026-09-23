import Link from "next/link";
import { CostByModelChart } from "@/components/CostByModelChart";
import { StatTile } from "@/components/StatTile";
import { UsageTable } from "@/components/UsageTable";
import { getIdentity } from "@/lib/auth";
import { formatCost, formatTokens } from "@/lib/format";
import { getDashboardData } from "@/lib/usage";

// Usage changes on every request — always read fresh data.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const identity = await getIdentity();

  if (!identity) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold">Log in to see your usage</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Requests are tracked per guest or account, so there&apos;s nothing to show
          until you&apos;re identified as one or the other.
        </p>
        <Link
          href="/login?next=/dashboard"
          className="mt-4 inline-block rounded-md bg-[var(--text-primary)] px-4 py-2.5 text-sm font-medium text-[var(--on-primary)]"
        >
          Log in or continue as a guest
        </Link>
      </div>
    );
  }

  let data;
  let loadError: string | null = null;
  try {
    data = await getDashboardData(identity, 50);
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

  const { logs, summary, models, totals, scope } = data;
  const modelsUsed = summary.filter((s) => s.request_count > 0).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {scope === "admin" ? "Usage dashboard" : "My usage"}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {scope === "admin"
            ? "Admin view — requests, tokens, and estimated spend across every guest and account."
            : "Requests, tokens, and estimated spend for your own guest session or account."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatTile label="Total requests" value={formatTokens(totals.request_count)} />
        <StatTile
          label="Errors"
          value={formatTokens(totals.error_count)}
          tone={totals.error_count > 0 ? "critical" : undefined}
        />
        <StatTile label="Total tokens" value={formatTokens(totals.total_tokens)} />
        <StatTile label="Total cost" value={formatCost(totals.total_cost_usd)} />
        <StatTile label="Models used" value={String(modelsUsed)} />
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="eyebrow mb-4">Cost by model</h2>
        <CostByModelChart
          summary={summary}
          modelOrder={models.map((m) => m.model_id)}
        />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="eyebrow mb-4">Recent requests</h2>
        <UsageTable logs={logs} />
      </section>
    </div>
  );
}
