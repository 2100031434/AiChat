import Link from "next/link";

// nav-bar per DESIGN.md: sits on the page canvas (not an elevated card),
// separated by a single bottom hairline. nav-link gets a fully-rounded
// hover pill, matching the component spec.
export function Nav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--page)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
        >
          LLM Usage Tracker
        </Link>
        <nav className="flex gap-1 text-sm text-[var(--text-secondary)]">
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 transition-colors hover:bg-[var(--gridline)] hover:text-[var(--text-primary)]"
          >
            Process
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full px-3 py-1.5 transition-colors hover:bg-[var(--gridline)] hover:text-[var(--text-primary)]"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
