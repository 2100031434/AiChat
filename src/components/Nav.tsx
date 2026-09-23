import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          LLM Usage Tracker
        </Link>
        <nav className="flex gap-6 text-sm text-[var(--text-secondary)]">
          <Link href="/" className="transition-colors hover:text-[var(--text-primary)]">
            Process
          </Link>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-[var(--text-primary)]"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
