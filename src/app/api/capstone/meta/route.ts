import { notBuiltYet } from "@/lib/not-built-yet";

/**
 * ── TODO: Lane 5 — Challenge 5, "Capstone" ───────────────────────────────
 * You'll build this after Chapters 20–22. This route declares your chosen
 * decision domain (staffing | inventory | pricing | channels) and echoes
 * your token; see the challenge page for the wire contract (the exact JSON
 * to send and receive).
 * Until then it returns 501 so probes honestly fail.
 */
export async function GET() {
  return notBuiltYet(5, "Capstone: Advocacy + Live Decision Service");
}
