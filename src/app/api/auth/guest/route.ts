import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { setIdentityCookie } from "@/lib/auth";

// Explicit opt-in only — called when someone clicks "Continue as a guest",
// never run automatically on page load. The guest id is just a random
// token; there's no database row for it until they actually run a request.
export async function POST() {
  await setIdentityCookie({ kind: "guest", id: randomUUID() });
  return NextResponse.json({ ok: true });
}
