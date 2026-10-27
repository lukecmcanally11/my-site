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

// ── Later-lane stubs: these SHOULD fail until their lane ────────────────────
console.log("\nLater-lane stubs (these should NOT pass yet — 501 is correct):");
const stubs = [
  ...(challenge2Built ? [] : [["/api/reasoning/meta", "Lane 2"]]),
  ...(challenge3Built ? [] : [["/api/simulator/meta", "Lane 3"]]),
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
if (challenge1Failures === 0 && challenge2Failures === 0 && challenge3Failures === 0 && stubProblems === 0) {
  if (challenge3Built) {
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
  if (stubProblems > 0) {
    parts.push(`${stubProblems} stub problem${stubProblems === 1 ? "" : "s"}`);
  }
  console.log(`${parts.join(" and ")} failing. Fix the items marked \u2717 above and run selfcheck again.`);
  process.exit(1);
}