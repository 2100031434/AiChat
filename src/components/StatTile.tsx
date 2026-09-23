export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}
