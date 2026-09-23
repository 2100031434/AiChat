export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
