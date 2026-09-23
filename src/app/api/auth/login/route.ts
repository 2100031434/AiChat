import { NextResponse } from "next/server";
import { checkAdminCredentials, setIdentityCookie, verifyPassword } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

// Well-formed "salt:derivedKeyHex" (64-byte key, matching hashPassword's
// output shape) that matches no real password — just here so an unknown
// username still pays the same scrypt cost as a known one.
const DUMMY_PASSWORD_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  if (checkAdminCredentials(username, password)) {
    await setIdentityCookie({ kind: "admin" });
    return NextResponse.json({ ok: true, kind: "admin" });
  }

  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, username, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Hash against a dummy value when the username doesn't exist, rather than
  // short-circuiting, so a response doesn't come back measurably faster for
  // unknown usernames than for known ones with a wrong password (username
  // enumeration via timing).
  const passwordMatches = await verifyPassword(
    password,
    user?.password_hash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordMatches) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await setIdentityCookie({ kind: "user", id: user.id, username: user.username });
  return NextResponse.json({ ok: true, kind: "user", username: user.username });
}
