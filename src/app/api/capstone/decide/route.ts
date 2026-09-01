import { notBuiltYet } from "@/lib/not-built-yet";

/**
 * ── TODO: Lane 5 — Challenge 5, "Capstone" ───────────────────────────────
 * The platform will POST decision probes for your chosen domain here; your
 * service returns the empirically best action with its expected value. See
 * the challenge page for the contract.
 * Until then it returns 501 so probes honestly fail.
 */
export async function POST() {
  return notBuiltYet(5, "Capstone: Advocacy + Live Decision Service");
}
