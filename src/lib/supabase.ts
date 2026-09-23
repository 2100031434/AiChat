import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Server-only client authenticated with the service-role key. Never import
// this file from a Client Component — the service role bypasses Row Level
// Security, so it must stay behind API routes.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
