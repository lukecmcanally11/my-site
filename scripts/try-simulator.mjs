#!/usr/bin/env node
/**
 * npm run try-reasoning [-- <url>]
 *
 * Challenge 2 practice swings, without spending a battery run. Sends one
 * sample problem of each type to YOUR /api/reasoning/decide (local dev
 * server by default) and prints your answer next to the correct one:
 *
 *   npm run try-reasoning                                  # local dev server
 *   npm run try-reasoning -- https://your-site.vercel.app  # deployed site
 *
 * The real battery is limited to 3 runs per 24 hours. This script is
 * unlimited: make it green first, then spend a run.
 *
 * Like selfcheck, this is a small, deliberate reimplementation of the
 * course grader's arithmetic (course-platform/src/lib/challenges/
 * reasoning.ts). If the wire contract evolves, re-sync by hand.
 */

const siteUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const TOLERANCE = 0.01;

// ── The three sample problems (same shapes as the challenge page) ──────────
const SAMPLES = [
  {
    probeId: "try-syllogism",
    type: "syllogism",
    rule: { if: "we cut the price", then: "unit sales rise" },
    observation: { statement: "We observe that unit sales rise.", asserts: "B" },
    conclusion: { statement: "Therefore, we cut the price.", asserts: "A" },
  },
  {
    probeId: "try-plausibility",
    type: "plausibility",
    scenario:
      "2% of transactions are fraudulent. The system catches 90% of fraudulent transactions and false-alarms on 10% of the rest. One has just been flagged. Return the posterior probability that it is actually fraudulent.",
    baseRate: 0.02,
    hitRate: 0.9,
    falseAlarmRate: 0.1,
  },
  {
    probeId: "try-bernoulli",
    type: "bernoulli",
    scenario:
      "X = 1 when the ad gets clicked (probability theta = 0.35), X = 0 when the ad is ignored. Payoff is $120 when X = 1 and $-40 when X = 0. Return the support of X, the expected payoff, and P(X = 0).",
    theta: 0.35,
    payoffs: { onSuccess: 120, onFailure: -40 },
    probabilityOf: 0,
  },
];

// ── Ground truth (the arithmetic the grader uses) ───────────────────────────
function solve(problem) {
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
    const N = 10000; // cancels in the division; keeps the names honest
    const trueFlags = N * problem.baseRate * problem.hitRate;
    const falseFlags = N * (1 - problem.baseRate) * problem.falseAlarmRate;
    return { posterior: trueFlags / (trueFlags + falseFlags) };
  }
  const { theta, payoffs, probabilityOf } = problem;
  return {
    support: [0, 1],
    expectedValue: theta * payoffs.onSuccess + (1 - theta) * payoffs.onFailure,
    probabilityStatement: probabilityOf === 1 ? theta : 1 - theta,
  };
}

// ── Grading helpers (mirror the platform's tolerance and normalization) ─────
function asNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function normalizeFallacy(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (/affirm/.test(s) && /consequent/.test(s)) return "affirming the consequent";
  if (/den(y|i)/.test(s) && /antecedent/.test(s)) return "denying the antecedent";
  return null;
}

function numberMiss(name, got, want) {
  const n = asNumber(got);
  if (n === null) return `no numeric \`${name}\` in your response`;
  if (Math.abs(n - want) > TOLERANCE) {
    return `${name} is ${n}, correct is ${Number(want.toFixed(6))} (tolerance \u00b1${TOLERANCE})`;
  }
  return null;
}

/** Returns null when the answer would pass the battery, else the reason. */
function grade(problem, answer) {
  const truth = solve(problem);
  if (problem.type === "syllogism") {
    if (answer?.verdict !== truth.verdict) {
      return `verdict is "${String(answer?.verdict)}", correct is "${truth.verdict}"`;
    }
    if (truth.verdict === "invalid" && normalizeFallacy(answer?.fallacy) !== truth.fallacy) {
      return `fallacy is "${String(answer?.fallacy ?? "(missing)")}", correct is "${truth.fallacy}"`;
    }
    return null;
  }
  if (problem.type === "plausibility") {
    return numberMiss("posterior", answer?.posterior, truth.posterior);
  }
  const s = answer?.support;
  if (!Array.isArray(s) || s.length !== 2 || Number(s[0]) !== 0 || Number(s[1]) !== 1) {
    return "`support` must be the array [0, 1]";
  }
  return (
    numberMiss("expectedValue", answer?.expectedValue, truth.expectedValue) ??
    numberMiss("probabilityStatement", answer?.probabilityStatement, truth.probabilityStatement)
  );
}

// ── Send the three samples ──────────────────────────────────────────────────
console.log(`\nTry-reasoning against ${siteUrl}\n`);
let failures = 0;

for (const problem of SAMPLES) {
  let res;
  try {
    res = await fetch(`${siteUrl}/api/reasoning/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(problem),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.log(`  \u2717 ${problem.type}: could not connect. Is the dev server running at ${siteUrl}?`);
    failures++;
    continue;
  }

  if (res.status === 501) {
    console.log(
      `  \u2717 ${problem.type}: 501 Not Implemented. Fill in this type's TODO block in src/app/api/reasoning/decide/route.ts`
    );
    failures++;
    continue;
  }
  if (!res.ok) {
    console.log(`  \u2717 ${problem.type}: HTTP ${res.status} from POST /api/reasoning/decide`);
    failures++;
    continue;
  }

  let answer = null;
  try {
    answer = await res.json();
  } catch {
    console.log(`  \u2717 ${problem.type}: the response was not valid JSON`);
    failures++;
    continue;
  }

  const miss = grade(problem, answer);
  const yours = JSON.stringify(answer);
  const correct = JSON.stringify(solve(problem));
  if (miss === null) {
    console.log(`  \u2713 ${problem.type}: correct`);
    console.log(`      yours:   ${yours}`);
  } else {
    console.log(`  \u2717 ${problem.type}: ${miss}`);
    console.log(`      yours:   ${yours}`);
    console.log(`      correct: ${correct}`);
    failures++;
  }
}

console.log("");
if (failures === 0) {
  console.log("All three sample problems answered correctly. The battery sends 30 of");
  console.log("these with fresh parameters; your formulas cover them all. Next step:");
  console.log("npm run selfcheck (it also checks your meta route and /reasoning page).");
  process.exit(0);
} else {
  console.log(
    `${failures} problem type${failures === 1 ? "" : "s"} failing. Fix the marked TODO block(s) and run again: this script is unlimited, the battery is not.`
  );
  process.exit(1);
}