import { notBuiltYet } from "@/lib/not-built-yet";

/**
 * ── TODO: Lane 4 — Challenge 4, "Causality Audit Service" ────────────────
 * The platform will POST datasets with business narratives here; your
 * service names the causal structure and says whether to stratify. See the
 * challenge page for the contract and the course-provided helper.
 * Until then it returns 501 so probes honestly fail.
 */
export async function POST() {
  return notBuiltYet(4, "Causality Audit Service");
}
