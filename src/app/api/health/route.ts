import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { profile } from "@/profile";

/**
 * The course platform's heartbeat check (Station 1.3). It expects:
 *   { ok: true, studentToken: "<your token>", deployedAt: "<ISO timestamp>",
 *     repoUrl: "https://github.com/you/your-repo" }
 *
 * repoUrl comes from src/profile.ts; the grader uses it for the Git-history
 * check. Your token comes from the SITE_TOKEN env var. Set it in .env.local
 * locally AND in Vercel's Environment Variables (copy it exactly from the
 * course's /register-site page). Nothing to edit in this file.
 *
 * The extra `database` field reports whether this site can reach YOUR
 * Supabase project (Chapter 3, Step 5). It is informational: `ok` is about
 * the site itself and stays true even when the database is down, so a
 * napping database can never fail your health check.
 */

// This line runs once when the site starts up, so it ≈ when you last deployed.
const deployedAt = new Date().toISOString();

/**
 * One tiny read (counting the guestbook signatures) proves the whole chain:
 * env vars present, Supabase reachable, table created, read allowed.
 */
async function databaseStatus(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return "not configured";
  try {
    const { count, error } = await createClient(url, key)
      .from("guestbook")
      .select("*", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(3000));
    if (error) {
      return /abort|timeout/i.test(error.message)
        ? "error: could not reach the database"
        : `error: ${error.message}`;
    }
    const n = count ?? 0;
    return `connected (${n} guestbook signature${n === 1 ? "" : "s"})`;
  } catch {
    return "error: could not reach the database";
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    studentToken: process.env.SITE_TOKEN ?? "SITE_TOKEN-env-var-not-set",
    deployedAt,
    repoUrl: profile.repoUrl,
    database: await databaseStatus(),
  });
}
