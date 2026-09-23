export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "critical";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] ${
          tone === "critical" ? "text-[var(--critical)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
