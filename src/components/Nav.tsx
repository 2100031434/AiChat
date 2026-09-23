import Link from "next/link";
import { getIdentity } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

// nav-bar per DESIGN.md: sits on the page canvas (not an elevated card),
// separated by a single bottom hairline. nav-link gets a fully-rounded
// hover pill, matching the component spec.
export async function Nav() {
  const identity = await getIdentity();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--page)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
        >
          LLM Usage Tracker
        </Link>
        <nav className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
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
            {identity?.kind === "admin" ? "Dashboard (admin)" : "My usage"}
          </Link>
          {identity ? (
            <>
              <span className="eyebrow ml-2 hidden sm:inline">
                {identity.kind === "admin"
                  ? "admin"
                  : identity.kind === "user"
                    ? identity.username
                    : "guest"}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="ml-2 rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-sm font-medium text-[var(--on-primary)]"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
