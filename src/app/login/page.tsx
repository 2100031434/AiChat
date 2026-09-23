"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"guest" | "login" | null>(null);

  function nextPath(): string {
    if (typeof window === "undefined") return "/";
    return new URLSearchParams(window.location.search).get("next") || "/";
  }

  async function continueAsGuest() {
    setError(null);
    setLoading("guest");
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't start a guest session.");
      router.push(nextPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("login");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed.");
      router.push(nextPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Log in
      </h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Or skip this and continue without an account.
      </p>

      <button
        type="button"
        onClick={continueAsGuest}
        disabled={loading !== null}
        className="mt-6 w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-opacity disabled:opacity-50"
      >
        {loading === "guest" ? "Starting…" : "Continue as a guest"}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        or log in
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1.5">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        {error && (
          <p className="rounded-md border border-[var(--critical)]/30 bg-[var(--critical)]/10 px-3 py-2 text-sm text-[var(--critical)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading !== null || !username || !password}
          className="w-full rounded-md bg-[var(--text-primary)] px-4 py-2.5 text-sm font-medium text-[var(--on-primary)] transition-opacity disabled:opacity-40"
        >
          {loading === "login" ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        No account?{" "}
        <Link href="/signup" className="text-[var(--accent)]">
          Sign up
        </Link>
      </p>
    </div>
  );
}
