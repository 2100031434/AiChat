import { NextResponse } from "next/server";
import { hashPassword, setIdentityCookie } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-32 characters: letters, numbers, _ or -." },
      { status: 400 },
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from("app_users")
    .insert({ username, password_hash: passwordHash })
    .select("id, username")
    .single();

  if (error) {
    // Postgres unique_violation on app_users.username.
    if (error.code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await setIdentityCookie({ kind: "user", id: data.id, username: data.username });
  return NextResponse.json({ ok: true, username: data.username });
}
