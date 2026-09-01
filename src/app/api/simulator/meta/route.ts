import { notBuiltYet } from "@/lib/not-built-yet";

/**
 * ── TODO: Lane 3 — Challenge 3, "Decision Simulator" ─────────────────────
 * You'll build this after Chapters 10–14. This route proves the service is
 * yours by echoing your token; see the challenge page for the wire contract
 * (the exact JSON to send and receive).
 * Until then it returns 501 so probes honestly fail.
 */
export async function GET() {
  return notBuiltYet(3, "Decision Simulator");
}
