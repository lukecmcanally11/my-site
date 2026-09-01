import { notBuiltYet } from "@/lib/not-built-yet";

/**
 * ── TODO: Lane 3 — Challenge 3, "Decision Simulator" ─────────────────────
 * The platform will POST seeded investment games here; your service
 * simulates the paths and returns the growth-optimal stake fraction with
 * its statistics. See the challenge page for the contract.
 * Until then it returns 501 so probes honestly fail.
 */
export async function POST() {
  return notBuiltYet(3, "Decision Simulator");
}
