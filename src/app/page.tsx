import { ProcessForm } from "@/components/ProcessForm";
import { listActiveModels } from "@/lib/pricing";
import type { ModelPricing } from "@/lib/types";

// Model list is DB-driven (see supabase/schema.sql) so it can grow without a
// redeploy — fetch it fresh on every request rather than caching at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  let models: ModelPricing[] = [];
  let setupError: string | null = null;

  try {
    models = await listActiveModels();
  } catch (err) {
    setupError = err instanceof Error ? err.message : "Failed to load models.";
  }

  if (setupError || models.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold">Setup required</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {setupError ??
            "No active models found. Run supabase/schema.sql against your Supabase project to seed the model registry."}
        </p>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          See README.md for environment variable and database setup instructions.
        </p>
      </div>
    );
  }

  return <ProcessForm models={models} />;
}
