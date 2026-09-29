import { createClient } from "@supabase/supabase-js";

export type ProblemType = "syllogism" | "plausibility" | "bernoulli";

export interface LatestEntry {
  problem: Record<string, any>;
  answer: Record<string, any>;
}

export type Latest = Record<ProblemType, LatestEntry | null>;

// Same client helper as the guestbook route, accepting the same env-var
// name variants so a paste from Supabase's Connect dialog just works.
function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function saveLatest(
  type: ProblemType,
  problem: LatestEntry["problem"],
  answer: LatestEntry["answer"]
): Promise<void> {
  const client = supabase();
  if (!client) {
    throw new Error("Supabase env vars not set. See .env.example and the README.");
  }
  const { error } = await client
    .from("reasoning_latest")
    .upsert({ type, problem, answer, updated_at: new Date().toISOString() });
  if (error) {
    throw new Error(`Could not save the latest ${type}: ${error.message}`);
  }
}

export async function loadLatest(): Promise<Latest> {
  const empty: Latest = { syllogism: null, plausibility: null, bernoulli: null };
  const client = supabase();
  if (!client) return empty;
  const { data, error } = await client
    .from("reasoning_latest")
    .select("type, problem, answer");
  if (error || !data) return empty;
  for (const row of data) {
    if (row.type === "syllogism" || row.type === "plausibility" || row.type === "bernoulli") {
      empty[row.type as ProblemType] = { problem: row.problem, answer: row.answer };
    }
  }
  return empty;
}