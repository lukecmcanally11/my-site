#!/usr/bin/env node
/**
 * npm run selfcheck [-- <url>]
 *
 * Probes YOUR site with the same Challenge 1 checks the course platform
 * runs, and tells you what to fix in plain language. Node builtins only;
 * nothing to install beyond the template itself.
 *
 *   npm run selfcheck                                  # local dev server
 *   npm run selfcheck -- https://your-site.vercel.app  # your deployed site
 *
 * These checks are a deliberate, small reimplementation of the platform's
 * grader (course-platform/src/lib/challenges/live-site.ts). The template is
 * cloned on its own, so it can't import from the platform; if the grader
 * changes, this script must be re-synced by hand.
 *
 * Selfcheck is functional-only. The beauty bonus is the professor's call;
 * no script can grade taste.
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const siteUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const TIMEOUT_MS = 10_000;

// ── Expected token: SITE_TOKEN env var, falling back to .env.local ─────────
function expectedToken() {
  if (process.env.SITE_TOKEN) return process.env.SITE_TOKEN;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/^\s*SITE_TOKEN\s*=\s*(.+?)\s*$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// ── Tiny check harness ──────────────────────────────────────────────────────
const results = [];
function report(ok, label, detail) {
  results.push({ ok, label, detail });
  const mark = ok ? "\u2713" : "\u2717";
  console.log(`  ${mark} ${label}`);
  if (!ok && detail) console.log(`      ${detail}`);
}

async function get(path, init) {
  const url = path.startsWith("http") ? path : `${siteUrl}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      text: await res.text(),
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      status: 0,
      contentType: "",
      text: "",
      error: timedOut
        ? `no response within ${TIMEOUT_MS / 1000}s`
        : `could not connect. Is the site running at ${siteUrl}?`,
    };
  }
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

console.log(`\nSelfcheck for ${siteUrl}\n`);

// ── 1. /api/health ──────────────────────────────────────────────────────────
console.log("Challenge 1 checks (what the course platform grades):");
const token = expectedToken();
let repoUrl = null;
{
  const res = await get("/api/health");
  if (res.error || !res.ok) {
    report(false, "GET /api/health", res.error ?? `returned HTTP ${res.status}`);
  } else {
    const body = json(res.text);
    if (!body || body.ok !== true || !body.studentToken || !body.deployedAt) {
      report(
        false,
        "GET /api/health",
        "response must be JSON: { ok: true, studentToken, deployedAt }"
      );
    } else if (Number.isNaN(Date.parse(body.deployedAt))) {
      report(false, "GET /api/health", "deployedAt is not a parseable timestamp");
    } else if (body.studentToken === "SITE_TOKEN-env-var-not-set") {
      report(
        false,
        "GET /api/health",
        "SITE_TOKEN env var is not set on the site — add it to .env.local (and Vercel) from the course's /register-site page, then restart/redeploy"
      );
    } else if (token && body.studentToken !== token) {
      report(
        false,
        "GET /api/health",
        `the site's studentToken ("${body.studentToken}") doesn't match your local SITE_TOKEN ("${token}") — one of the two is stale`
      );
    } else {
      if (typeof body.repoUrl === "string" && body.repoUrl.trim()) {
        repoUrl = body.repoUrl.trim();
      }
      report(
        true,
        `GET /api/health — reachable, token ${token ? "matches" : "present (no local SITE_TOKEN to compare against)"}, timestamp ok`
      );
      // Advisory only: the database field never gates the health check,
      // but it predicts whether the guestbook round-trip below can pass.
      const db = typeof body.database === "string" ? body.database : "";
      if (db.startsWith("connected")) {
        console.log(`      \u00b7 database: ${db}`);
      } else if (db === "not configured") {
        console.log(
          "      \u00b7 database: not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Chapter 3, Step 5); the guestbook check below will fail until you do"
        );
      } else if (db.startsWith("error")) {
        console.log(
          `      \u00b7 database: ${db} — env vars are set but the read failed; check that you ran supabase/guestbook.sql and that your Supabase project isn't paused`
        );
      }
    }
  }
}

// ── 2. /api/whoami ──────────────────────────────────────────────────────────
let whoamiEmail = null;
{
  const res = await get("/api/whoami");
  if (res.error || !res.ok) {
    report(false, "GET /api/whoami", res.error ?? `returned HTTP ${res.status}`);
  } else {
    const body = json(res.text);
    if (!body || typeof body.name !== "string" || body.name.trim() === "") {
      report(false, "GET /api/whoami", 'response must be JSON: { name: "...", email: "..." }');
    } else if (body.name === "Your Name" || body.email === "you@udel.edu") {
      report(
        false,
        "GET /api/whoami",
        "still the placeholder identity — fill in displayName and email in src/profile.ts"
      );
    } else if (typeof body.email !== "string" || !body.email.includes("@")) {
      report(false, "GET /api/whoami", "email is missing or malformed");
    } else {
      whoamiEmail = body.email;
      report(true, `GET /api/whoami — ${body.name} <${body.email}>`);
      console.log(
        `      (the real battery also checks this email matches your course sign-in — make sure it's the one you use on the platform)`
      );
    }
  }
}

// ── 3. /api/profile ─────────────────────────────────────────────────────────
let profile = null;
{
  const res = await get("/api/profile");
  if (res.error || !res.ok) {
    report(false, "GET /api/profile", res.error ?? `returned HTTP ${res.status}`);
  } else {
    const body = json(res.text);
    const problems = [];
    if (!body || typeof body !== "object") problems.push("response is not JSON");
    else {
      if (typeof body.displayName !== "string" || body.displayName.trim() === "")
        problems.push("displayName is missing");
      let urlOk = false;
      try {
        new URL(body.photoUrl);
        urlOk = true;
      } catch {
        problems.push("photoUrl is not a valid absolute URL");
      }
      if (typeof body.hometown !== "string" || body.hometown.trim() === "")
        problems.push("hometown is missing");
      if (
        !Array.isArray(body.funFacts) ||
        body.funFacts.length < 2 ||
        body.funFacts.length > 4 ||
        body.funFacts.some((f) => typeof f !== "string" || f.length < 3)
      )
        problems.push("funFacts must be 2–4 strings (each at least 3 characters)");
      if (typeof body.decisionImProudOf !== "string" || body.decisionImProudOf.length < 3)
        problems.push("decisionImProudOf is missing or too short");
      if (!["class", "professor-only"].includes(body.rosterVisibility))
        problems.push('rosterVisibility must be "class" or "professor-only"');
      if (problems.length === 0 && urlOk) profile = body;
    }
    if (profile) report(true, `GET /api/profile — roster contract satisfied for ${profile.displayName}`);
    else report(false, "GET /api/profile", `${problems.join("; ")} — edit src/profile.ts`);
  }
}

// ── 4. Photo loads ──────────────────────────────────────────────────────────
{
  if (!profile) {
    report(false, "Roster photo loads", "skipped — fix /api/profile first");
  } else {
    const res = await get(profile.photoUrl);
    if (res.error || !res.ok) {
      report(false, "Roster photo loads", res.error ?? `photoUrl returned HTTP ${res.status}`);
    } else if (!res.contentType.startsWith("image/")) {
      report(
        false,
        "Roster photo loads",
        `photoUrl responded with content-type "${res.contentType}" — point it at an image file`
      );
    } else {
      report(true, "Roster photo loads — and it's an image");
      if (profile.photoUrl.endsWith("/photo.svg")) {
        console.log(
          "      (heads-up: that's still the placeholder graphic — swap in a real photo before the roster sees it)"
        );
      }
    }
  }
}

// ── 5. Personalized home page ───────────────────────────────────────────────
{
  const res = await get("/");
  if (res.error || !res.ok) {
    report(false, "Personalized home page", res.error ?? `returned HTTP ${res.status}`);
  } else {
    const html = res.text;
    const text = html.toLowerCase();
    const problems = [];
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
    if (!title || /create next app/i.test(title)) problems.push("give the page its own <title>");
    if (/lorem ipsum/i.test(text)) problems.push("remove the lorem-ipsum filler");
    if (!/decision\s+services?/i.test(text))
      problems.push('keep a "portfolio of decision services" section');
    if (profile && !text.includes(profile.displayName.toLowerCase()))
      problems.push(`mention your name ("${profile.displayName}")`);
    if (problems.length === 0) report(true, "Personalized home page — own title, your name, portfolio scaffold");
    else report(false, "Personalized home page", problems.join("; "));
  }
}

// ── 6. /about agrees with the API ───────────────────────────────────────────
{
  const res = await get("/about");
  if (res.error || !res.ok) {
    report(false, "/about matches the API", res.error ?? `returned HTTP ${res.status}`);
  } else if (!profile) {
    report(false, "/about matches the API", "skipped the agreement check — fix /api/profile first");
  } else {
    const text = res.text.toLowerCase();
    const problems = [];
    if (!text.includes(profile.displayName.toLowerCase()))
      problems.push(`display your name ("${profile.displayName}")`);
    if (!text.includes(profile.hometown.toLowerCase()))
      problems.push(`display your hometown ("${profile.hometown}")`);
    if (!/<img[\s>]/i.test(res.text)) problems.push("show your photo (an <img>)");
    if (problems.length === 0)
      report(true, "/about matches the API — humans and machines agree");
    else report(false, "/about matches the API", problems.join("; "));
  }
}

// ── 7 & 8. Guestbook round-trip ─────────────────────────────────────────────
{
  const marker = `selfcheck-${randomUUID().slice(0, 13)}`;
  const write = await get("/api/guestbook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Selfcheck", message: `Hello from selfcheck (${marker}).` }),
  });
  if (write.error || !write.ok) {
    const body = json(write.text);
    report(
      false,
      "POST /api/guestbook",
      body?.error ?? write.error ?? `returned HTTP ${write.status} — is your Supabase set up? (supabase/guestbook.sql + env vars)`
    );
    report(false, "GET /api/guestbook round-trip", "skipped — the write must succeed first");
  } else {
    report(true, "POST /api/guestbook — write accepted");
    const read = await get("/api/guestbook");
    const body = json(read.text);
    if (read.error || !read.ok) {
      report(false, "GET /api/guestbook round-trip", read.error ?? `returned HTTP ${read.status}`);
    } else if (!Array.isArray(body)) {
      report(false, "GET /api/guestbook round-trip", "must return a JSON array of entries");
    } else if (!read.text.includes(marker)) {
      report(
        false,
        "GET /api/guestbook round-trip",
        "the entry just written didn't come back — write and read must hit the same table"
      );
    } else {
      report(true, "GET /api/guestbook round-trip — your database round-trip works");
    }
  }
}

// ── 9. GitHub commit history (best-effort; fail-quiet on API outages) ───────
{
  if (!repoUrl) {
    report(
      false,
      "GitHub commit history",
      'add repoUrl to src/profile.ts — a https://github.com/you/your-repo URL; /api/health echoes it'
    );
  } else {
    try {
      new URL(repoUrl);
    } catch {
      report(false, "GitHub commit history", `repoUrl is not a valid URL: "${repoUrl}"`);
    }
    if (!repoUrl.includes("github.com")) {
      report(false, "GitHub commit history", "repoUrl must be a https://github.com/owner/repo URL");
    } else {
      const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
      if (!m) {
        report(false, "GitHub commit history", "could not parse owner/repo from repoUrl");
      } else {
        const [, owner, repo] = m;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, "")}/commits?per_page=100`;
        try {
          const res = await fetch(apiUrl, {
            headers: { Accept: "application/vnd.github+json", "User-Agent": "gdaas-selfcheck" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (res.status === 429 || res.status === 403 || res.status >= 500) {
            report(
              true,
              "GitHub commit history — skipped (GitHub is unavailable from here; the real grader also skips this check when that happens)"
            );
          } else if (res.status === 404) {
            report(
              false,
              "GitHub commit history",
              `repo ${owner}/${repo} not found (404) — is it public and spelled correctly?`
            );
          } else if (!res.ok) {
            report(false, "GitHub commit history", `GitHub API returned HTTP ${res.status}`);
          } else {
            const commits = await res.json();
            const dates = (Array.isArray(commits) ? commits : [])
              .map((c) => c.commit?.author?.date)
              .filter((d) => d && !Number.isNaN(Date.parse(d)))
              .map((d) => Date.parse(d));
            if (dates.length < 5) {
              report(
                false,
                "GitHub commit history",
                `only ${dates.length} commit(s) — need ≥ 5; commit early and often (Station 1.2)`
              );
            } else {
              const spreadMs = Math.max(...dates) - Math.min(...dates);
              if (spreadMs < 24 * 60 * 60 * 1000) {
                report(
                  false,
                  "GitHub commit history",
                  `${dates.length} commits but they span less than 24h — looks like a bulk dump`
                );
              } else {
                report(
                  true,
                  `GitHub commit history — ${dates.length} commits over ${(spreadMs / 86_400_000).toFixed(1)} days`
                );
              }
            }
          }
        } catch {
          report(
            true,
            "GitHub commit history — skipped (could not reach GitHub; the real grader also skips this check when that happens)"
          );
        }
      }
    }
  }
}

const challenge1Failures = results.filter((r) => !r.ok).length;

// ── Later-lane stubs: these SHOULD fail until their lane ────────────────────
console.log("\nLater-lane stubs (these should NOT pass yet — 501 is correct):");
const stubs = [
  ["/api/reasoning/meta", "Lane 2"],
  ["/api/simulator/meta", "Lane 3"],
  ["/api/causality/meta", "Lane 4"],
  ["/api/capstone/meta", "Lane 5"],
];
let stubProblems = 0;
for (const [path, lane] of stubs) {
  const res = await get(path);
  if (res.status === 501) {
    console.log(`  \u2713 ${path} — 501, honestly unfinished (${lane}'s challenge fills it in)`);
  } else if (res.ok) {
    stubProblems++;
    console.log(
      `  \u2717 ${path} — returned HTTP ${res.status} but ${lane} isn't built; a stub that pretends to work will fail the real battery in confusing ways`
    );
  } else {
    console.log(`  \u2713 ${path} — HTTP ${res.status}, not passing (fine until ${lane})`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log("");
if (challenge1Failures === 0 && stubProblems === 0) {
  console.log("All Challenge 1 checks pass. Deploy, register on the course platform,");
  console.log("and run the real probe battery from the Challenge 1 page.");
  console.log("(Selfcheck can't check one thing: that /api/whoami's email matches your");
  console.log("course sign-in. And remember: beauty is graded by a human, not a script.)");
  process.exit(0);
} else {
  console.log(
    `${challenge1Failures} Challenge 1 check${challenge1Failures === 1 ? "" : "s"} failing${
      stubProblems > 0 ? ` (and ${stubProblems} stub problem${stubProblems === 1 ? "" : "s"})` : ""
    }. Fix the items marked \u2717 above and run selfcheck again.`
  );
  process.exit(1);
}
