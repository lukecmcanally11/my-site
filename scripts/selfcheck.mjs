#!/usr/bin/env node
/**
 * npm run selfcheck [-- <url>]
 *
 * Probes YOUR site with the same Challenge 1 checks the course platform
 * runs, and tells you what to fix in plain language. Node builtins only;
 * nothing to install beyond the template itself. Once your reasoning
 * service answers (Challenge 2, after Lane 2), a Challenge 2 section runs
 * automatically: meta handshake, nine sample problems, and the /reasoning
 * page's live-data binding. Once your decision simulator answers
 * (Challenge 3, after Lane 3), a Challenge 3 section runs the same way:
 * meta handshake, three sample games, the /simulator page, and its DAG image.
 * Once your causality auditor answers (Challenge 4, after Lane 4), a
 * Challenge 4 section adds four sample audits, the /causality page, and its
 * DAG image. Once your capstone service answers (Challenge 5, after Lane 5),
 * a Challenge 5 section sends your own problem (my-problem.json) and two
 * practice problems, then checks the /capstone page's eight data-capstone
 * elements.
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
          "      \u00b7 database: not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Chapter 3, Step 5); if you already pasted them, check the variable NAMES character-for-character against .env.example — a paste from Supabase may have named the key differently; the guestbook check below will fail until this is fixed"
        );
      } else if (/permission denied/i.test(db)) {
        console.log(
          `      \u00b7 database: ${db} — the table exists but its grant line was never run; in the Supabase SQL Editor, run the last line of supabase/guestbook.sql (grant select, insert on public.guestbook to anon;)`
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
          } else if (res.status === 404 && (owner === "your-username" || repo === "your-repo")) {
            report(
              false,
              "GitHub commit history",
              `repoUrl is still the template's placeholder (github.com/${owner}/${repo}). Copy your repo's address from GitHub (like https://github.com/YOURNAME/my-site), paste it as repoUrl in src/profile.ts, save, then git add -A, git commit -m "Point repoUrl at my GitHub repo", and git push`
            );
          } else if (res.status === 404) {
            report(
              false,
              "GitHub commit history",
              `GitHub has no public repo at github.com/${owner}/${repo}: either repoUrl in src/profile.ts has a typo, or the repo is private (on GitHub: repo Settings, bottom of General, Change visibility)`
            );
          } else if (!res.ok) {
            report(false, "GitHub commit history", `GitHub API returned HTTP ${res.status}`);
          } else {
            const commits = await res.json();
            const dates = (Array.isArray(commits) ? commits : [])
              .map((c) => c.commit?.author?.date)
              .filter((d) => d && !Number.isNaN(Date.parse(d)))
              .map((d) => Date.parse(d));
            const DAY_MS = 24 * 60 * 60 * 1000;
            const oldest = dates.length ? Math.min(...dates) : Date.now();
            const readyAt = oldest + DAY_MS;
            const when = (ms) =>
              new Date(ms).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
            const steps = `to commit: make a real change, save, then git add -A, git commit -m "Say what changed", and git push (only pushed commits count)`;
            if (dates.length < 5) {
              const timing =
                Date.now() < readyAt
                  ? `; your first commit was ${when(oldest)}, so make at least one of them after ${when(readyAt)}`
                  : "";
              report(
                false,
                "GitHub commit history",
                `${dates.length} commit${dates.length === 1 ? "" : "s"} on GitHub — Challenge 1 needs 5, so make ${5 - dates.length} more${timing}; ${steps}`
              );
            } else {
              const spreadMs = Math.max(...dates) - oldest;
              if (spreadMs < DAY_MS) {
                const fix =
                  Date.now() >= readyAt
                    ? "that time has passed, so one more commit today does it"
                    : "commits made before then won't count toward the gap";
                report(
                  false,
                  "GitHub commit history",
                  `${dates.length} commits, all within ${(spreadMs / 3_600_000).toFixed(1)} hours — Challenge 1 needs at least 24 hours between your first and last commit. Your first was ${when(oldest)}, so you need one more after ${when(readyAt)}; ${fix}; ${steps}`
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

// ── Challenge 2: runs once your /api/reasoning/meta answers 200 ─────────────
// Until then, that route stays in the "honest stubs" list below. These checks
// reimplement the platform's Challenge 2 grader the same way the checks above
// reimplement Challenge 1's (course-platform/src/lib/challenges/reasoning.ts).
const c2 = [];
function report2(ok, label, detail) {
  c2.push({ ok, label, detail });
  const mark = ok ? "\u2713" : "\u2717";
  console.log(`  ${mark} ${label}`);
  if (!ok && detail) console.log(`      ${detail}`);
}

function solveReasoning(problem) {
  if (problem.type === "syllogism") {
    const forms = {
      A: { verdict: "valid" },
      "not-B": { verdict: "valid" },
      B: { verdict: "invalid", fallacy: "affirming the consequent" },
      "not-A": { verdict: "invalid", fallacy: "denying the antecedent" },
    };
    return forms[problem.observation.asserts];
  }
  if (problem.type === "plausibility") {
    const t = problem.baseRate * problem.hitRate;
    const f = (1 - problem.baseRate) * problem.falseAlarmRate;
    return { posterior: t / (t + f) };
  }
  const { theta, payoffs, probabilityOf } = problem;
  return {
    support: [0, 1],
    expectedValue: theta * payoffs.onSuccess + (1 - theta) * payoffs.onFailure,
    probabilityStatement: probabilityOf === 1 ? theta : 1 - theta,
  };
}

function asNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Returns null when the answer would pass the platform's grader, else why. */
function gradeReasoning(problem, answer) {
  const truth = solveReasoning(problem);
  if (problem.type === "syllogism") {
    if (answer?.verdict !== truth.verdict) {
      return `verdict was "${String(answer?.verdict)}", the structure says "${truth.verdict}"`;
    }
    if (truth.verdict === "invalid") {
      const s = String(answer?.fallacy ?? "").toLowerCase();
      const named =
        /affirm/.test(s) && /consequent/.test(s)
          ? "affirming the consequent"
          : /den(y|i)/.test(s) && /antecedent/.test(s)
            ? "denying the antecedent"
            : null;
      if (named !== truth.fallacy) {
        return `fallacy was "${String(answer?.fallacy ?? "(missing)")}", this structure commits "${truth.fallacy}"`;
      }
    }
    return null;
  }
  if (problem.type === "plausibility") {
    const p = asNum(answer?.posterior);
    if (p === null) return "no numeric `posterior` in the response";
    if (Math.abs(p - truth.posterior) > 0.01) {
      return `posterior ${p} is outside \u00b10.01 of the correct value`;
    }
    return null;
  }
  const s = answer?.support;
  if (!Array.isArray(s) || s.length !== 2 || Number(s[0]) !== 0 || Number(s[1]) !== 1) {
    return "`support` must be the array [0, 1]";
  }
  const ev = asNum(answer?.expectedValue);
  if (ev === null) return "no numeric `expectedValue` in the response";
  if (Math.abs(ev - truth.expectedValue) > 0.01) {
    return `expectedValue ${ev} is outside \u00b10.01 of the correct value`;
  }
  const ps = asNum(answer?.probabilityStatement);
  if (ps === null) return "no numeric `probabilityStatement` in the response";
  if (Math.abs(ps - truth.probabilityStatement) > 0.01) {
    return `probabilityStatement ${ps} is outside \u00b10.01 of the correct value`;
  }
  return null;
}

// Fixed sample problems, three per type. The real battery sends 30 with
// fresh seeded parameters; formulas that pass these pass those.
const C2_PROBLEMS = [
  {
    probeId: "selfcheck-syllogism-1",
    type: "syllogism",
    rule: { if: "we cut the price", then: "unit sales rise" },
    observation: { statement: "We observe that we cut the price.", asserts: "A" },
    conclusion: { statement: "Therefore, unit sales rise.", asserts: "B" },
  },
  {
    probeId: "selfcheck-syllogism-2",
    type: "syllogism",
    rule: { if: "the ad campaign runs", then: "the landing page gets traffic" },
    observation: {
      statement: "We observe that it is NOT the case that the landing page gets traffic.",
      asserts: "not-B",
    },
    conclusion: {
      statement: "Therefore, it is not the case that the ad campaign runs.",
      asserts: "not-A",
    },
  },
  {
    probeId: "selfcheck-syllogism-3",
    type: "syllogism",
    rule: { if: "we cut the price", then: "unit sales rise" },
    observation: { statement: "We observe that unit sales rise.", asserts: "B" },
    conclusion: { statement: "Therefore, we cut the price.", asserts: "A" },
  },
  {
    probeId: "selfcheck-plausibility-1",
    type: "plausibility",
    scenario:
      "2% of transactions are fraudulent. The system catches 90% of fraudulent transactions and false-alarms on 10% of the rest. One has just been flagged.",
    baseRate: 0.02,
    hitRate: 0.9,
    falseAlarmRate: 0.1,
  },
  {
    probeId: "selfcheck-plausibility-2",
    type: "plausibility",
    scenario:
      "5% of units are defective. The scanner catches 80% of defective units and false-alarms on 6% of the rest. One has just been flagged.",
    baseRate: 0.05,
    hitRate: 0.8,
    falseAlarmRate: 0.06,
  },
  {
    probeId: "selfcheck-plausibility-3",
    type: "plausibility",
    scenario:
      "1% of accounts are about to churn. The model catches 95% of churning accounts and false-alarms on 3% of the rest. One has just been flagged.",
    baseRate: 0.01,
    hitRate: 0.95,
    falseAlarmRate: 0.03,
  },
  {
    probeId: "selfcheck-bernoulli-1",
    type: "bernoulli",
    scenario:
      "X = 1 when the ad gets clicked (probability theta = 0.35). Payoff is $120 when X = 1 and $-40 when X = 0.",
    theta: 0.35,
    payoffs: { onSuccess: 120, onFailure: -40 },
    probabilityOf: 0,
  },
  {
    probeId: "selfcheck-bernoulli-2",
    type: "bernoulli",
    scenario:
      "X = 1 when the shipment arrives on time (probability theta = 0.6). Payoff is $80 when X = 1 and $-30 when X = 0.",
    theta: 0.6,
    payoffs: { onSuccess: 80, onFailure: -30 },
    probabilityOf: 1,
  },
  {
    probeId: "selfcheck-bernoulli-3",
    type: "bernoulli",
    scenario:
      "X = 1 when the customer buys the upsell (probability theta = 0.22). Payoff is $150 when X = 1 and $-90 when X = 0.",
    theta: 0.22,
    payoffs: { onSuccess: 150, onFailure: -90 },
    probabilityOf: 0,
  },
];

let challenge2Built = false;
{
  const res = await get("/api/reasoning/meta");
  if (res.status === 200) {
    challenge2Built = true;
    console.log("\nChallenge 2 checks (your reasoning service is live):");

    // 1. The meta handshake.
    const body = json(res.text);
    if (!body || body.service !== "reasoning") {
      report2(
        false,
        "GET /api/reasoning/meta",
        'response must be JSON of the form { service: "reasoning", specVersion: "1", studentToken }'
      );
    } else if (String(body.specVersion) !== "1") {
      report2(
        false,
        "GET /api/reasoning/meta",
        `specVersion must be "1" (got "${String(body.specVersion)}")`
      );
    } else if (!body.studentToken || body.studentToken === "SITE_TOKEN-env-var-not-set") {
      report2(
        false,
        "GET /api/reasoning/meta",
        "studentToken is missing: the route must return process.env.SITE_TOKEN, and that env var must be set"
      );
    } else if (token && body.studentToken !== token) {
      report2(
        false,
        "GET /api/reasoning/meta",
        `the site's studentToken ("${body.studentToken}") doesn't match your local SITE_TOKEN ("${token}")`
      );
    } else {
      report2(true, "GET /api/reasoning/meta: service announced, token present");
    }

    // 2. Nine decide probes, three per type. The platform's battery sends 30.
    const lastAnswers = {};
    const misses = [];
    let correct = 0;
    for (const problem of C2_PROBLEMS) {
      const r = await get("/api/reasoning/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(problem),
      });
      let miss;
      let answer = null;
      if (r.error) {
        miss = r.error;
      } else if (!r.ok) {
        miss = `HTTP ${r.status}`;
      } else {
        answer = json(r.text);
        miss = answer === null ? "response was not valid JSON" : gradeReasoning(problem, answer);
      }
      if (miss === null) correct += 1;
      else misses.push(`${problem.probeId}: ${miss}`);
      lastAnswers[problem.type] = answer;
    }
    if (correct === C2_PROBLEMS.length) {
      report2(true, `POST /api/reasoning/decide: ${correct}/${C2_PROBLEMS.length} sample problems correct`);
    } else {
      report2(
        false,
        `POST /api/reasoning/decide: ${correct}/${C2_PROBLEMS.length} sample problems correct`,
        `first miss ${misses[0]} (run npm run try-reasoning for a side-by-side of yours vs correct)`
      );
    }

    // 3. The /reasoning page displays the answers the API just gave.
    const page = await get("/reasoning");
    if (page.error || !page.ok) {
      report2(false, "GET /reasoning", page.error ?? `returned HTTP ${page.status}`);
    } else {
      const readAttr = (key) => {
        const m = page.text.match(
          new RegExp(`<[^>]*data-reasoning="${key}"[^>]*>([^<]*)<`)
        );
        return m ? m[1].trim() : null;
      };
      const problems = [];

      const verdictShown = readAttr("verdict");
      const lastVerdict = lastAnswers.syllogism?.verdict;
      if (verdictShown === null || verdictShown === "") {
        problems.push('no element with data-reasoning="verdict"');
      } else if (
        typeof lastVerdict === "string" &&
        verdictShown.toLowerCase() !== lastVerdict.toLowerCase()
      ) {
        problems.push(
          `the page shows verdict "${verdictShown}" but the API just answered "${lastVerdict}"`
        );
      }

      for (const b of [
        { key: "posterior", type: "plausibility", field: "posterior" },
        { key: "expected-value", type: "bernoulli", field: "expectedValue" },
      ]) {
        const shown = readAttr(b.key);
        const answered = asNum(lastAnswers[b.type]?.[b.field]);
        if (shown === null || shown === "") {
          problems.push(`no element with data-reasoning="${b.key}"`);
        } else if (answered !== null) {
          const shownNum = Number.parseFloat(shown.replace(/[$,]/g, ""));
          if (!Number.isFinite(shownNum) || Math.abs(shownNum - answered) > 0.005 + 1e-9) {
            problems.push(
              `data-reasoning="${b.key}" shows "${shown}" but the API just answered ${answered}`
            );
          }
        }
      }

      if (problems.length === 0) {
        report2(true, "/reasoning page: bound to the same live data the API serves");
      } else {
        report2(
          false,
          "/reasoning page bound to live data",
          `${problems.join("; ")}. The page must render the latest saved answers (lib/reasoning-store), not fixed text`
        );
      }
    }
  }
}
const challenge2Failures = c2.filter((r) => !r.ok).length;

// ── Challenge 3: runs once your /api/simulator/meta answers 200 ─────────────
// Same idea as Challenge 2: a small reimplementation of the platform's
// Challenge 3 grader (course-platform/src/lib/challenges/simulator.ts and
// src/lib/dist-math.ts). The correct answers are exact; your simulated
// numbers only need to land within the grader's tolerances.
const c3 = [];
function report3(ok, label, detail) {
  c3.push({ ok, label, detail });
  const mark = ok ? "\u2713" : "\u2717";
  console.log(`  ${mark} ${label}`);
  if (!ok && detail) console.log(`      ${detail}`);
}

function logGrowth(f, u, d) {
  return 0.5 * Math.log(1 + u * f) + 0.5 * Math.log(1 - d * f);
}

function solveGame(game) {
  const u = game.upPct / 100;
  const d = game.downPct / 100;
  const T = game.horizonYears;
  const growth = game.candidateFractions.map((f) => logGrowth(f, u, d));
  const f = game.candidateFractions[growth.indexOf(Math.max(...growth))];
  let maxLosingHeads = -1;
  for (let h = 0; h <= T; h++) {
    if (h * Math.log(1 + u * f) + (T - h) * Math.log(1 - d * f) < 0) maxLosingHeads = h;
  }
  let probLoss = 0;
  let c = 1;
  for (let i = 0; i <= maxLosingHeads; i++) {
    probLoss += c;
    c = (c * (T - i)) / (i + 1);
  }
  probLoss /= 2 ** T;
  return {
    recommendedFraction: f,
    medianFinalBalance: game.buyIn * Math.exp(T * logGrowth(f, u, d)),
    probLoss,
  };
}

/** Returns null when the answer would pass the platform's grader, else why. */
function gradeGame(game, answer) {
  const truth = solveGame(game);
  const fraction = asNum(answer?.recommendedFraction);
  const median = asNum(answer?.medianFinalBalance);
  const pLoss = asNum(answer?.probLoss);
  if (fraction === null) return "no numeric `recommendedFraction` in the response";
  if (median === null) return "no numeric `medianFinalBalance` in the response";
  if (pLoss === null) return "no numeric `probLoss` in the response";
  if (typeof answer.reasoning !== "string" || answer.reasoning.trim().length < 10) {
    return "`reasoning` must be a short plain-language sentence";
  }
  if (Math.abs(fraction - truth.recommendedFraction) > 1e-9) {
    return `recommendedFraction ${fraction}, correct is ${truth.recommendedFraction}`;
  }
  if (Math.abs(median - truth.medianFinalBalance) > Math.max(1, truth.medianFinalBalance * 0.05)) {
    return `medianFinalBalance ${Math.round(median)} is outside \u00b15% of the correct value`;
  }
  if (Math.abs(pLoss - truth.probLoss) > 0.03) {
    return `probLoss ${pLoss} is outside \u00b10.03 of the correct value`;
  }
  return null;
}

// Fixed sample games (the same three npm run try-simulator sends). The real
// battery sends 20 with fresh numbers; a service that passes these and
// simulates honestly passes those.
const C3_GAMES = [
  { up: 50, down: 40, years: 30, buyIn: 30000, candidates: [0.1, 0.25, 0.5, 1.0] },
  { up: 55, down: 40, years: 20, buyIn: 10000, candidates: [0.05, 0.2, 0.4, 0.8] },
  { up: 45, down: 35, years: 40, buyIn: 50000, candidates: [0.05, 0.15, 0.35, 0.55, 0.85, 1.0] },
].map((g, i) => ({
  probeId: `selfcheck-game-${i + 1}`,
  type: "investment-game",
  scenario: `Buy in with $${g.buyIn.toLocaleString("en-US")}; each year a fair coin flips the STAKED portion +${g.up}% (heads) or -${g.down}% (tails), for ${g.years} years. Choose the stake fraction, from the candidates, that maximizes the growth of the typical (median) path, and report that strategy's median final balance and probability of ending below the buy-in.`,
  upPct: g.up,
  downPct: g.down,
  horizonYears: g.years,
  buyIn: g.buyIn,
  candidateFractions: g.candidates,
}));

let challenge3Built = false;
{
  const res = await get("/api/simulator/meta");
  if (res.status === 200) {
    challenge3Built = true;
    console.log("\nChallenge 3 checks (your decision simulator is live):");

    // 1. The meta handshake.
    const body = json(res.text);
    if (!body || body.service !== "simulator") {
      report3(
        false,
        "GET /api/simulator/meta",
        'response must be JSON of the form { service: "simulator", specVersion: "1", studentToken }'
      );
    } else if (String(body.specVersion) !== "1") {
      report3(false, "GET /api/simulator/meta", `specVersion must be "1" (got "${String(body.specVersion)}")`);
    } else if (body.flavor !== undefined && body.flavor !== "investment-game") {
      report3(
        false,
        "GET /api/simulator/meta",
        `flavor is "${String(body.flavor)}". Leave the flavor field out (or set it to "investment-game")`
      );
    } else if (!body.studentToken || body.studentToken === "SITE_TOKEN-env-var-not-set") {
      report3(
        false,
        "GET /api/simulator/meta",
        "studentToken is missing: the route must return process.env.SITE_TOKEN, and that env var must be set"
      );
    } else if (token && body.studentToken !== token) {
      report3(
        false,
        "GET /api/simulator/meta",
        `the site's studentToken ("${body.studentToken}") doesn't match your local SITE_TOKEN ("${token}")`
      );
    } else {
      report3(true, "GET /api/simulator/meta: service announced, token present");
    }

    // 2. Three decide probes. The platform's battery sends 20.
    let lastAnswer = null;
    const misses = [];
    let correct = 0;
    for (const game of C3_GAMES) {
      const r = await get("/api/simulator/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(game),
      });
      let miss;
      let answer = null;
      if (r.error) {
        miss = r.error;
      } else if (!r.ok) {
        miss = `HTTP ${r.status}`;
      } else {
        answer = json(r.text);
        miss = answer === null ? "response was not valid JSON" : gradeGame(game, answer);
      }
      if (miss === null) correct += 1;
      else misses.push(`${game.probeId}: ${miss}`);
      lastAnswer = answer;
    }
    if (correct === C3_GAMES.length) {
      report3(true, `POST /api/simulator/decide: ${correct}/${C3_GAMES.length} sample games correct`);
    } else {
      report3(
        false,
        `POST /api/simulator/decide: ${correct}/${C3_GAMES.length} sample games correct`,
        `first miss ${misses[0]} (run npm run try-simulator for a side-by-side of yours vs correct)`
      );
    }

    // 3. The /simulator page displays the answer the API just gave, plus the DAG.
    const page = await get("/simulator");
    if (page.error || !page.ok) {
      report3(false, "GET /simulator", page.error ?? `returned HTTP ${page.status}`);
    } else {
      const readAttr = (key) => {
        const m = page.text.match(new RegExp(`<[^>]*data-simulator="${key}"[^>]*>([^<]*)<`));
        return m ? m[1].trim() : null;
      };
      const problems = [];
      for (const b of [
        { key: "recommended-fraction", field: "recommendedFraction", tolerance: 0.005 },
        { key: "median-final", field: "medianFinalBalance", tolerance: 1 },
        { key: "prob-loss", field: "probLoss", tolerance: 0.005 },
      ]) {
        const shown = readAttr(b.key);
        const answered = asNum(lastAnswer?.[b.field]);
        if (shown === null || shown === "") {
          problems.push(`no element with data-simulator="${b.key}" (or it holds more than plain text)`);
        } else if (answered !== null) {
          const shownNum = Number.parseFloat(shown.replace(/[$,%\s]/g, ""));
          if (!Number.isFinite(shownNum) || Math.abs(shownNum - answered) > b.tolerance + 1e-9) {
            problems.push(`data-simulator="${b.key}" shows "${shown}" but the API just answered ${answered}`);
          }
        }
      }

      const imgTag = page.text.match(/<img\b[^>]*data-simulator="dag"[^>]*>/);
      const src = imgTag ? (imgTag[0].match(/\bsrc="([^"]*)"/)?.[1] ?? "").replace(/&amp;/g, "&") : null;
      if (src === null) {
        problems.push('no <img data-simulator="dag"> (Step 5 of the build guide draws it)');
      } else if (!src) {
        problems.push('the data-simulator="dag" image has an empty src');
      } else {
        const img = await get(new URL(src, `${siteUrl}/simulator`).href);
        if (img.error || !img.ok) {
          problems.push(`the DAG image at "${src}" did not load (${img.error ?? `HTTP ${img.status}`})`);
        } else if (!img.contentType.toLowerCase().startsWith("image/")) {
          problems.push(`the DAG image at "${src}" is not an image (content-type "${img.contentType}")`);
        }
      }

      if (problems.length === 0) {
        report3(true, "/simulator page: shows the latest answer and a DAG image that loads");
      } else {
        report3(
          false,
          "/simulator page bound to live data",
          `${problems.join("; ")}. The page must render the latest saved answer (lib/simulator-store), not fixed text`
        );
      }
    }
  }
}
const challenge3Failures = c3.filter((r) => !r.ok).length;

// ── Challenge 4: runs once your /api/causality/meta answers 200 ─────────────
// A small reimplementation of the platform's Challenge 4 grader
// (course-platform/src/lib/challenges/causality.ts and src/lib/causal-math.ts):
// four fresh datasets, one per hidden structure, each guarded to be decisive.
const c4 = [];
function report4(ok, label, detail) {
  c4.push({ ok, label, detail });
  const mark = ok ? "\u2713" : "\u2717";
  console.log(`  ${mark} ${label}`);
  if (!ok && detail) console.log(`      ${detail}`);
}

let c4State = (Date.now() ^ 0x85ebca6b) >>> 0;
function c4Rand() {
  c4State = (c4State + 0x6d2b79f5) >>> 0;
  let t = c4State;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const c4Uniform = (a, b) => a + (b - a) * c4Rand();
function c4Normal(sd = 1) {
  const u1 = Math.max(c4Rand(), 1e-12);
  return sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * c4Rand());
}
const c4Mean = (ys) => ys.reduce((a, b) => a + b, 0) / ys.length;
const c4Naive = (rows) =>
  c4Mean(rows.filter((r) => r.x === 1).map((r) => r.y)) - c4Mean(rows.filter((r) => r.x === 0).map((r) => r.y));
function c4Strat(rows) {
  let w = 0;
  for (const z of [0, 1]) {
    const slice = rows.filter((r) => r.z === z);
    w += c4Naive(slice) * slice.length;
  }
  return w / rows.length;
}

function c4Rows(structure) {
  const rows = [];
  const sign = c4Rand() < 0.5 ? 1 : -1;
  const base = 30;
  const push = (x, z, y) => rows.push({ x, z, y: Math.round(y * 1000) / 1000 });
  for (let i = 0; i < 240; i++) {
    if (structure === "fork") {
      const z = c4Rand() < 0.5 ? 1 : 0;
      const x = c4Rand() < (z === 1 ? 0.24 : 0.76) ? 1 : 0;
      push(x, z, base + sign * 2.2 * z + c4Normal());
    } else if (structure === "pipe") {
      const x = c4Rand() < 0.5 ? 1 : 0;
      const z = c4Rand() < (x === 1 ? 0.8 : 0.2) ? 1 : 0;
      push(x, z, base + sign * 2.2 * z + c4Normal());
    } else if (structure === "collider") {
      const x = c4Rand() < 0.5 ? 1 : 0;
      const dev = c4Normal();
      const z = 1.5 * (x - 0.5) + sign * 1.5 * dev + c4Normal(0.6) > 0 ? 1 : 0;
      push(x, z, base + dev);
    } else {
      const x = c4Rand() < 0.5 ? 1 : 0;
      const z = c4Rand() < 0.5 ? 1 : 0;
      push(x, z, base + sign * 1.4 * x + c4Normal());
    }
  }
  return rows;
}

function c4Decisive(structure, rows) {
  for (const z of [0, 1]) for (const x of [0, 1]) if (rows.filter((r) => r.z === z && r.x === x).length < 15) return false;
  const a = Math.abs(c4Naive(rows));
  const s = Math.abs(c4Strat(rows));
  if (structure === "fork") return a >= 0.6 && s <= 0.15;
  if (structure === "pipe") return a >= 0.6 && s <= 0.15;
  if (structure === "collider") return a <= 0.15 && s >= 0.6;
  return a >= 0.6 && s >= 0.6 && Math.abs(c4Naive(rows) - c4Strat(rows)) <= 0.15;
}

const C4_STORIES = {
  fork: ["severity", "before-x", true, "surgeon", "Doc Dreamy", "Doc Duck", "high", "low", "symptom score"],
  pipe: ["fungus", "after-x", false, "treatment", "unsprayed", "sprayed", "present", "absent", "growth (cm)"],
  collider: ["offer", "after-x", false, "interview", "ordinary", "standout", "no", "yes", "reference score"],
  direct: ["device", "before-x", false, "checkoutFlow", "old", "new", "desktop", "mobile", "basket size ($)"],
};

const C4_PROBES = ["fork", "pipe", "collider", "direct"].map((structure, i) => {
  let rows = c4Rows(structure);
  for (let k = 0; k < 400 && !c4Decisive(structure, rows); k++) rows = c4Rows(structure);
  const [zLabel, zTiming, zInfluencesX, xLabel, x0, x1, z0, z1, yLabel] = C4_STORIES[structure];
  return {
    probe: {
      probeId: `selfcheck-audit-${i + 1}`,
      type: "causality-audit",
      context: {
        narrative: `Selfcheck sample: does ${xLabel} change ${yLabel}?`,
        xLabel, x0, x1, zLabel, z0, z1, yLabel,
        domainFacts: { zTiming, zInfluencesX },
      },
      candidateDAGs: [],
      dataset: rows,
    },
    truth: {
      structure,
      causal: structure === "pipe" || structure === "direct",
      advice: structure === "fork" ? "stratify" : "do-not-stratify",
      stratified: c4Strat(rows),
    },
  };
});

function gradeAudit(truth, ans) {
  if (!["fork", "pipe", "collider", "direct"].includes(ans?.structure)) return "`structure` must be fork, pipe, collider, or direct";
  if (typeof ans.causal !== "boolean") return "`causal` must be true or false";
  if (!["stratify", "do-not-stratify", "randomize"].includes(ans.advice)) return '`advice` must be "stratify" or "do-not-stratify"';
  const effect = asNum(ans.stratifiedEffect);
  if (effect === null) return "`stratifiedEffect` must be a number";
  if (typeof ans.reasoning !== "string" || ans.reasoning.trim().length < 10) return "`reasoning` must be a short plain-language sentence";
  if (ans.structure !== truth.structure) return `structure "${ans.structure}", correct is "${truth.structure}"`;
  if (ans.causal !== truth.causal) return `causal ${ans.causal}, correct is ${truth.causal}`;
  const adviceOk = truth.advice === "stratify" ? ans.advice !== "do-not-stratify" : ans.advice === "do-not-stratify";
  if (!adviceOk) return `advice "${ans.advice}", correct is "${truth.advice}"`;
  if (truth.structure === "fork" && Math.abs(effect - truth.stratified) > 0.05) {
    return `stratifiedEffect ${effect} is outside \u00b10.05 of the correct value`;
  }
  return null;
}

let challenge4Built = false;
{
  const res = await get("/api/causality/meta");
  if (res.status === 200) {
    challenge4Built = true;
    console.log("\nChallenge 4 checks (your causality auditor is live):");

    // 1. The meta handshake.
    const body = json(res.text);
    if (!body || body.service !== "causality") {
      report4(
        false,
        "GET /api/causality/meta",
        'response must be JSON of the form { service: "causality", specVersion: "1", studentToken }'
      );
    } else if (String(body.specVersion) !== "1") {
      report4(false, "GET /api/causality/meta", `specVersion must be "1" (got "${String(body.specVersion)}")`);
    } else if (!body.studentToken || body.studentToken === "SITE_TOKEN-env-var-not-set") {
      report4(
        false,
        "GET /api/causality/meta",
        "studentToken is missing: the route must return process.env.SITE_TOKEN, and that env var must be set"
      );
    } else if (token && body.studentToken !== token) {
      report4(
        false,
        "GET /api/causality/meta",
        `the site's studentToken ("${body.studentToken}") doesn't match your local SITE_TOKEN ("${token}")`
      );
    } else {
      report4(true, "GET /api/causality/meta: service announced, token present");
    }

    // 2. Four decide probes, one per structure. The platform's battery sends 24.
    let lastAnswer = null;
    const misses = [];
    let correct = 0;
    for (const { probe, truth } of C4_PROBES) {
      const r = await get("/api/causality/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(probe),
      });
      let miss;
      let answer = null;
      if (r.error) {
        miss = r.error;
      } else if (!r.ok) {
        miss = `HTTP ${r.status}${json(r.text)?.error ? `: ${json(r.text).error}` : ""}`;
      } else {
        answer = json(r.text);
        miss = answer === null ? "response was not valid JSON" : gradeAudit(truth, answer);
      }
      if (miss === null) correct += 1;
      else misses.push(`${probe.probeId} (${truth.structure}): ${miss}`);
      lastAnswer = answer;
    }
    if (correct === C4_PROBES.length) {
      report4(true, `POST /api/causality/decide: ${correct}/${C4_PROBES.length} sample probes correct`);
    } else {
      report4(
        false,
        `POST /api/causality/decide: ${correct}/${C4_PROBES.length} sample probes correct`,
        `first miss ${misses[0]} (run npm run try-causality for a side-by-side of yours vs correct)`
      );
    }

    // 3. The /causality page displays the answer the API just gave, plus the DAG.
    const page = await get("/causality");
    if (page.error || !page.ok) {
      report4(false, "GET /causality", page.error ?? `returned HTTP ${page.status}`);
    } else {
      const readAttr = (key) => {
        const m = page.text.match(new RegExp(`<[^>]*data-causality="${key}"[^>]*>([^<]*)<`));
        return m ? m[1].trim() : null;
      };
      const problems = [];
      const shownStructure = readAttr("structure");
      if (!shownStructure) {
        problems.push('no element with data-causality="structure"');
      } else if (lastAnswer && shownStructure.toLowerCase() !== String(lastAnswer.structure).toLowerCase()) {
        problems.push(`data-causality="structure" shows "${shownStructure}" but the API just answered "${lastAnswer.structure}"`);
      }
      const shownVerdict = readAttr("verdict");
      if (!shownVerdict) {
        problems.push('no element with data-causality="verdict"');
      } else if (lastAnswer && typeof lastAnswer.causal === "boolean") {
        const saysCausal = /\bcausal\b/i.test(shownVerdict) && !/\bnot[\s-]?causal\b/i.test(shownVerdict);
        if (saysCausal !== lastAnswer.causal) {
          problems.push(`data-causality="verdict" shows "${shownVerdict}" but the API just answered causal=${lastAnswer.causal}`);
        }
      }
      const shownEffect = readAttr("stratified-effect");
      const answeredEffect = asNum(lastAnswer?.stratifiedEffect);
      if (!shownEffect) {
        problems.push('no element with data-causality="stratified-effect"');
      } else if (answeredEffect !== null) {
        const shownNum = Number.parseFloat(shownEffect.replace(/[$,%\s]/g, ""));
        if (!Number.isFinite(shownNum) || Math.abs(shownNum - answeredEffect) > 0.011) {
          problems.push(`data-causality="stratified-effect" shows "${shownEffect}" but the API just answered ${answeredEffect}`);
        }
      }

      const imgTag = page.text.match(/<img\b[^>]*data-causality="dag"[^>]*>/);
      const src = imgTag ? (imgTag[0].match(/\bsrc="([^"]*)"/)?.[1] ?? "").replace(/&amp;/g, "&") : null;
      if (src === null) {
        problems.push('no <img data-causality="dag"> (Step 5 of the build guide draws the four DAGs)');
      } else if (!src) {
        problems.push('the data-causality="dag" image has an empty src');
      } else {
        const img = await get(new URL(src, `${siteUrl}/causality`).href);
        if (img.error || !img.ok) {
          problems.push(`the DAG image at "${src}" did not load (${img.error ?? `HTTP ${img.status}`})`);
        } else if (!img.contentType.toLowerCase().startsWith("image/")) {
          problems.push(`the DAG image at "${src}" is not an image (content-type "${img.contentType}")`);
        }
      }

      if (problems.length === 0) {
        report4(true, "/causality page: shows the latest answer and a DAG image that loads");
      } else {
        report4(
          false,
          "/causality page bound to live data",
          `${problems.join("; ")}. The page must render the latest saved answer (lib/causality-store), not fixed text`
        );
      }
    }
  }
}
const challenge4Failures = c4.filter((r) => !r.ok).length;

// ── Challenge 5: runs once your /api/capstone/meta answers 200 ─────────────
// Sample probes and grading come from scripts/capstone-probes.mjs (shared
// with try-capstone). The page checks mirror the platform's
// (course-platform/src/lib/challenges/capstone.ts).
const c5 = [];
function report5(ok, label, detail) {
  c5.push({ ok, label, detail });
  const mark = ok ? "\u2713" : "\u2717";
  console.log(`  ${mark} ${label}`);
  if (!ok && detail) console.log(`      ${detail}`);
}

let challenge5Built = false;
{
  const res = await get("/api/capstone/meta");
  if (res.status === 200) {
    challenge5Built = true;
    console.log("\nChallenge 5 checks (your capstone service is live):");
    const C5_DOMAINS = ["staffing", "inventory", "pricing", "channels"];

    // 1. The meta handshake, with the declared domain.
    const body = json(res.text);
    let domain = null;
    if (!body || body.service !== "capstone") {
      report5(
        false,
        "GET /api/capstone/meta",
        'response must be JSON of the form { service: "capstone", specVersion: "2", studentToken, domain }'
      );
    } else if (String(body.specVersion) !== "2") {
      report5(false, "GET /api/capstone/meta", `specVersion must be "2" (got "${String(body.specVersion)}")`);
    } else if (!body.studentToken || body.studentToken === "SITE_TOKEN-env-var-not-set") {
      report5(
        false,
        "GET /api/capstone/meta",
        "studentToken is missing: the route must return process.env.SITE_TOKEN, and that env var must be set"
      );
    } else if (token && body.studentToken !== token) {
      report5(
        false,
        "GET /api/capstone/meta",
        `the site's studentToken ("${body.studentToken}") doesn't match your local SITE_TOKEN ("${token}")`
      );
    } else if (!C5_DOMAINS.includes(body.domain)) {
      report5(
        false,
        "GET /api/capstone/meta",
        `domain must be one of ${C5_DOMAINS.join(", ")} (got "${String(body.domain)}")`
      );
    } else {
      domain = body.domain;
      report5(true, `GET /api/capstone/meta: service announced, token present, domain "${domain}"`);
    }

    let probes = null;
    if (domain) {
      try {
        probes = await import("./capstone-probes.mjs");
      } catch {
        report5(
          false,
          "scripts/capstone-probes.mjs",
          "this file is missing; copy it from the course template on GitHub (the build guide's Before you build section)"
        );
      }
    }

    if (domain && probes) {
      // 2. Your own problem, then two practice problems. The platform's
      // battery sends your problem plus 14 test problems.
      const mine = probes.readMyProblem();
      let myAnswer = null;
      if (!mine) {
        report5(
          false,
          `POST /api/capstone/decide: your problem`,
          `no ${probes.MY_PROBLEM_FILE} in the project folder; download it from the Capstone page on the course platform`
        );
      } else if (mine.domain !== domain) {
        report5(
          false,
          `POST /api/capstone/decide: your problem`,
          `${probes.MY_PROBLEM_FILE} is for "${mine.domain}" but your meta route declares "${domain}"; download the file for your domain`
        );
      } else {
        const { answer, error } = await probes.askSite(siteUrl, mine);
        let miss = error ?? null;
        if (!miss) {
          try {
            miss = await probes.checkAnswer(mine, answer);
          } catch (err) {
            miss = err instanceof Error ? err.message : String(err);
          }
        }
        if (miss === null) {
          myAnswer = answer;
          report5(true, "POST /api/capstone/decide: your problem answered correctly");
        } else {
          report5(false, "POST /api/capstone/decide: your problem", `${miss} (run npm run try-capstone for details)`);
        }
      }

      let practice = [];
      try {
        practice = await probes.fetchPractice(domain, 2);
      } catch (err) {
        report5(false, "practice problems", err instanceof Error ? err.message : String(err));
      }
      if (practice.length > 0) {
        const misses = [];
        for (const [i, { probe }] of practice.entries()) {
          const { answer, error } = await probes.askSite(siteUrl, probe);
          let miss = error ?? null;
          if (!miss) {
            try {
              miss = await probes.checkAnswer(probe, answer);
            } catch (err) {
              miss = err instanceof Error ? err.message : String(err);
            }
          }
          if (miss !== null) misses.push(`practice ${i + 1}: ${miss}`);
        }
        const correct = practice.length - misses.length;
        if (misses.length === 0) {
          report5(true, `POST /api/capstone/decide: ${correct}/${practice.length} practice problems correct`);
        } else {
          report5(
            false,
            `POST /api/capstone/decide: ${correct}/${practice.length} practice problems correct`,
            `first miss ${misses[0]} (run npm run try-capstone for yours next to the correct numbers)`
          );
        }
      }

      // 3. The /capstone report shows your own problem and the answer the
      // API just gave for it.
      const page = myAnswer ? await get("/capstone") : null;
      if (page && (page.error || !page.ok)) {
        report5(false, "GET /capstone", page.error ?? `returned HTTP ${page.status}`);
      } else if (page) {
        const strip = (html) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
        // The text inside the first element carrying data-capstone="key",
        // including text in nested tags.
        const inner = (key) => {
          const open = page.text.match(new RegExp(`<([a-zA-Z0-9]+)\\b[^>]*data-capstone="${key}"[^>]*>`));
          if (!open) return null;
          const tag = open[1];
          const from = open.index + open[0].length;
          let depth = 1;
          const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
          re.lastIndex = from;
          let m;
          while ((m = re.exec(page.text))) {
            depth += m[1] ? -1 : 1;
            if (depth === 0) return page.text.slice(from, m.index);
          }
          return page.text.slice(from);
        };
        const readAttr = (key) => {
          const html = inner(key);
          return html === null ? null : strip(html);
        };
        const openTag = (key) => page.text.match(new RegExp(`<[^>]*data-capstone="${key}"[^>]*>`))?.[0] ?? null;
        const share = (text) => {
          const t = text.replace(/,/g, "");
          const inN = /(\d+(?:\.\d+)?)\s*(?:in|out of)\s*(\d+)/i.exec(t);
          if (inN) return Number(inN[1]) / Number(inN[2]);
          const pc = /(\d+(?:\.\d+)?)\s*%/.exec(t);
          if (pc) return Number(pc[1]) / 100;
          const num = /\d*\.?\d+/.exec(t);
          if (!num) return null;
          const v = Number(num[0]);
          return v > 1 ? v / 100 : v;
        };
        const problems = [];
        const rec = readAttr("recommendation");
        if (rec === null || rec.length < 15) {
          problems.push('data-capstone="recommendation" must hold your recommendation as a real sentence');
        }
        const shownAction = readAttr("action");
        if (!shownAction) {
          problems.push('no element with data-capstone="action"');
        } else if (shownAction.toLowerCase() !== String(myAnswer.action).toLowerCase()) {
          problems.push(`data-capstone="action" shows "${shownAction}" but the API just answered "${myAnswer.action}"`);
        }
        const chosen = myAnswer.outcomes?.[myAnswer.action] ?? {};
        const shownTypical = readAttr("typical-result");
        const answeredTypical = asNum(chosen.typical);
        if (!shownTypical) {
          problems.push('no element with data-capstone="typical-result"');
        } else if (answeredTypical !== null) {
          const n = Number.parseFloat(shownTypical.replace(/[$,\s]/g, ""));
          if (!Number.isFinite(n) || Math.abs(n - answeredTypical) > Math.max(1, Math.abs(answeredTypical) * 0.0075)) {
            problems.push(`data-capstone="typical-result" shows "${shownTypical}" but the API just answered ${Math.round(answeredTypical)}`);
          }
        }
        const shownChance = readAttr("chance-short");
        const answeredChance = asNum(chosen.chanceShort);
        if (!shownChance) {
          problems.push('no element with data-capstone="chance-short"');
        } else if (answeredChance !== null) {
          const v = share(shownChance);
          if (v === null || Math.abs(v - answeredChance) > 0.01) {
            problems.push(`data-capstone="chance-short" shows "${shownChance}" but the API just answered ${Math.round(answeredChance * 1000) / 10}%`);
          }
        }
        const chartTag = openTag("all-data-chart");
        const points = chartTag ? Number.parseInt(chartTag.match(/data-points="(\d+)"/)?.[1] ?? "", 10) : NaN;
        if (!chartTag) {
          problems.push('no element with data-capstone="all-data-chart"');
        } else if (points !== mine.history.length) {
          problems.push(`data-capstone="all-data-chart" must have data-points="${mine.history.length}" (the rows in your problem); got "${Number.isFinite(points) ? points : "nothing"}"`);
        }
        const outcomeHtml = inner("outcome-chart");
        const outcomeTag = openTag("outcome-chart") ?? "";
        if (outcomeHtml === null) {
          problems.push('no element with data-capstone="outcome-chart"');
        } else if (!/<(svg|img|canvas)\b/i.test(outcomeHtml) && !/^<(svg|img|canvas)\b/i.test(outcomeTag)) {
          problems.push('data-capstone="outcome-chart" must contain the chart itself (an svg or img)');
        }
        const dagTag = openTag("dag");
        const nodes = dagTag ? Number.parseInt(dagTag.match(/data-nodes="(\d+)"/)?.[1] ?? "", 10) : NaN;
        if (!dagTag) {
          problems.push('no element with data-capstone="dag"');
        } else if (nodes !== mine.dag.nodes.length) {
          problems.push(`data-capstone="dag" must have data-nodes="${mine.dag.nodes.length}" (the nodes in your recipe); got "${Number.isFinite(nodes) ? nodes : "nothing"}"`);
        }
        const unc = readAttr("uncertainty");
        if (unc === null || unc.length < 20 || !/\d/.test(unc)) {
          problems.push('data-capstone="uncertainty" must say how sure the reader can be, in plain words, with at least one number');
        }
        const bodyText = strip(page.text.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " "));
        const jargon = [
          ["Greek letters", /[\u0391-\u03A9\u03B1-\u03C9]/],
          ["Greek letter names", /\b(sigma|lambda|theta)\b/i],
          ["p-values", /\bp[\s-]?values?\b|\bp\s*[<>=\u2264]\s*0?\.\d/i],
          ['"statistically significant"', /statistical(ly)?\s+significan/i],
          ["distribution names", /\b(poisson|gaussian|bernoulli|binomial|normal distribution|normally distributed|uniform distribution)\b/i],
          ["distribution parameters", /\b(standard deviation|std\.? dev|variance)\b/i],
          ['"percentile"', /percentile/i],
          ['"bootstrap"', /bootstrap/i],
        ].filter(([, re]) => re.test(bodyText)).map(([label]) => label);
        if (jargon.length > 0) {
          problems.push(`the page uses words the reader should not see: ${jargon.join(", ")}`);
        }
        if (problems.length === 0) {
          report5(true, "/capstone report: shows your problem, both outcome charts, the recipe, and plain words");
        } else {
          report5(
            false,
            "/capstone report bound to live data",
            `${problems.join("; ")}. The page must be built from loadLatest() and simulateAll(), not fixed text`
          );
        }
      }
    }
  }
}
const challenge5Failures = c5.filter((r) => !r.ok).length;

// ── Later-lane stubs: these SHOULD fail until their lane ────────────────────
console.log("\nLater-lane stubs (these should NOT pass yet — 501 is correct):");
const stubs = [
  ...(challenge2Built ? [] : [["/api/reasoning/meta", "Lane 2"]]),
  ...(challenge3Built ? [] : [["/api/simulator/meta", "Lane 3"]]),
  ...(challenge4Built ? [] : [["/api/causality/meta", "Lane 4"]]),
  ...(challenge5Built ? [] : [["/api/capstone/meta", "Lane 5"]]),
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
if (
  challenge1Failures === 0 &&
  challenge2Failures === 0 &&
  challenge3Failures === 0 &&
  challenge4Failures === 0 &&
  challenge5Failures === 0 &&
  stubProblems === 0
) {
  if (challenge5Built) {
    console.log("All Challenge 1 to 5 checks pass. Deploy, then run the real probe");
    console.log("battery from the Capstone page on the course platform.");
  } else if (challenge4Built) {
    console.log("All Challenge 1, 2, 3, and 4 checks pass. Deploy, then run the real");
    console.log("probe battery from the Challenge 4 page on the course platform.");
  } else if (challenge3Built) {
    console.log("All Challenge 1, 2, and 3 checks pass. Deploy, then run the real");
    console.log("probe battery from the Challenge 3 page on the course platform.");
  } else if (challenge2Built) {
    console.log("All Challenge 1 and Challenge 2 checks pass. Deploy, then run the");
    console.log("real probe battery from the Challenge 2 page on the course platform.");
  } else {
    console.log("All Challenge 1 checks pass. Deploy, register on the course platform,");
    console.log("and run the real probe battery from the Challenge 1 page.");
  }
  console.log("(Selfcheck can't check one thing: that /api/whoami's email matches your");
  console.log("course sign-in. And remember: beauty is graded by a human, not a script.)");
  process.exit(0);
} else {
  const parts = [];
  if (challenge1Failures > 0) {
    parts.push(`${challenge1Failures} Challenge 1 check${challenge1Failures === 1 ? "" : "s"}`);
  }
  if (challenge2Failures > 0) {
    parts.push(`${challenge2Failures} Challenge 2 check${challenge2Failures === 1 ? "" : "s"}`);
  }
  if (challenge3Failures > 0) {
    parts.push(`${challenge3Failures} Challenge 3 check${challenge3Failures === 1 ? "" : "s"}`);
  }
  if (challenge4Failures > 0) {
    parts.push(`${challenge4Failures} Challenge 4 check${challenge4Failures === 1 ? "" : "s"}`);
  }
  if (challenge5Failures > 0) {
    parts.push(`${challenge5Failures} Challenge 5 check${challenge5Failures === 1 ? "" : "s"}`);
  }
  if (stubProblems > 0) {
    parts.push(`${stubProblems} stub problem${stubProblems === 1 ? "" : "s"}`);
  }
  console.log(`${parts.join(" and ")} failing. Fix the items marked \u2717 above and run selfcheck again.`);
  process.exit(1);
}