import { NextResponse } from "next/server";
import { clearIdentityCookie } from "@/lib/auth";

export async function POST() {
  await clearIdentityCookie();
  return NextResponse.json({ ok: true });
}
