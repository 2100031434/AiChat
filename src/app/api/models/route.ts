import { NextResponse } from "next/server";
import { listActiveModels } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const models = await listActiveModels();
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
