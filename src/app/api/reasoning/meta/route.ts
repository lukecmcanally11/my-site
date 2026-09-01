import { notBuiltYet } from "@/lib/not-built-yet";

/**
 * ── TODO: Lane 2 — Challenge 2, "Reasoning & Uncertainty Service" ────────
 * You'll build this after Chapters 5–9. The challenge page on the course
 * platform publishes the wire contract (the exact JSON to send and receive).
 * This route proves the service is yours by answering
 * { ok: true, studentToken, service: "reasoning" }.
 * Until then it returns 501 so probes honestly fail.
 */
export async function GET() {
  return notBuiltYet(2, "Reasoning & Uncertainty Service");
}
