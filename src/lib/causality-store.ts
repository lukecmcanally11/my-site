import { createClient } from "@supabase/supabase-js";

/**
 * The causality auditor's memory (Challenge 4).
 *
 * Same reason as the simulator store: your API route forgets everything
 * the moment it answers, but your /causality page must display the same
 * answer. So the route writes the answer down in Supabase and the page
 * reads it back.
 *
 * Two functions, two callers:
 *   - saveLatest(): called by /api/causality/decide after every answer.
 *   - loadLatest(): called by the /causality page to display it.
 *
 * Setup: run supabase/causality.sql once in your Supabase SQL Editor.
 * No new env vars.
 */

/** Average outcome for the two groups of X, in one slice of the data. */
export interface GroupMeans {
  /** "All data", or one level of the third variable, such as "severity: high". */
  label: string;
  n0: number;
  mean0: number;
  n1: number;
  mean1: number;
}

/** What the brain computed from the data rows. */
export interface CausalitySummary {
  naive: number;
  stratified: number;
  /** groups[0] is all the data; groups[1] and groups[2] are the two levels of Z. */
  groups: GroupMeans[];
}

/** The stored probe (story only), answer, and data summary. */
export interface CausalityLatest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  probe: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: Record<string, any>;
  summary: CausalitySummary;
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Overwrite the one stored "latest" row. */
export async function saveLatest(
  probe: CausalityLatest["probe"],
  answer: CausalityLatest["answer"],
  summary: CausalitySummary
): Promise<void> {
  const client = supabase();
  if (!client) {
    throw new Error("Supabase env vars not set. See .env.example and the README.");
  }
  const { error } = await client.from("causality_latest").upsert({
    key: "latest",
    probe,
    answer,
    summary,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Could not save the latest audit: ${error.message}`);
  }
}

/**
 * Read the stored row back. Returns null when no probe has been answered
 * yet, when Supabase isn't configured, or when the table doesn't exist yet.
 */
export async function loadLatest(): Promise<CausalityLatest | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client
    .from("causality_latest")
    .select("probe, answer, summary")
    .eq("key", "latest")
    .maybeSingle();
  if (error || !data) return null;
  return data as CausalityLatest;
}