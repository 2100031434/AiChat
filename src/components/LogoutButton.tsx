"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-full px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--gridline)] hover:text-[var(--text-primary)] disabled:opacity-50"
    >
      {loading ? "…" : "Log out"}
    </button>
  );
}
