#!/usr/bin/env node
/**
 * npm run try-simulator [-- <url>]
 *
 * Challenge 3 practice runs, without spending a battery run. Sends three
 * sample investment games to YOUR /api/simulator/decide (local dev server by
 * default) and prints your answer next to the correct one:
 *
 *   npm run try-simulator                                  # local dev server
 *   npm run try-simulator -- https://your-site.vercel.app  # deployed site
 *
 * The real battery is limited to 3 runs per 24 hours. This script is
 * unlimited: make it green first, then spend a run.
 *
 * Like selfcheck, this is a small, deliberate reimplementation of the
 * course grader's arithmetic (course-platform/src/lib/challenges/
 * simulator.ts and src/lib/dist-math.ts). The correct answers are computed
 * exactly, not simulated, so your simulated numbers will be close to them,
 * not equal. If the wire contract evolves, re-sync by hand.
 */

const siteUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const MEDIAN_REL_TOLERANCE = 0.05;
const PROB_LOSS_TOLERANCE = 0.03;
const TIMEOUT_MS = 10_000;

// ── The three sample games (same shape the grader sends) ────────────────────
const SAMPLES = [
  {
    probeId: "try-game-1",
    type: "investment-game",
    scenario:
      "Chapter 13's game: buy in with $30,000; each year a fair coin flips the STAKED portion +50% (heads) or -40% (tails), for 30 years. Choose the stake fraction, from the candidates, that maximizes the growth of the typical (median) path, and report that strategy's median final balance and probability of ending below the buy-in.",
    upPct: 50,
    downPct: 40,
    horizonYears: 30,
    buyIn: 30000,
    candidateFractions: [0.1, 0.25, 0.5, 1.0],
  },
  {
    probeId: "try-game-2",
    type: "investment-game",
    scenario:
      "A commodity desk pitches a yearly leveraged position: buy in with $10,000; each year a fair coin flips the STAKED portion +55% (heads) or -40% (tails), for 20 years. Choose the stake fraction, from the candidates, that maximizes the growth of the typical (median) path, and report that strategy's median final balance and probability of ending below the buy-in.",
    upPct: 55,
    downPct: 40,
    horizonYears: 20,
    buyIn: 10000,
    candidateFractions: [0.05, 0.2, 0.4, 0.8],
  },
  {
    probeId: "try-game-3",
    type: "investment-game",
    scenario:
      "A startup accelerator offers a recurring convertible-note game: buy in with $50,000; each year a fair coin flips the STAKED portion +45% (heads) or -35% (tails), for 40 years. Choose the stake fraction, from the candidates, that maximizes the growth of the typical (median) path, and report that strategy's median final balance and probability of ending below the buy-in.",
    upPct: 45,
    downPct: 35,
    horizonYears: 40,
    buyIn: 50000,
    candidateFractions: [0.05, 0.15, 0.35, 0.55, 0.85, 1.0],
  },
];

// ── Exact answers (the arithmetic the grader uses) ──────────────────────────
// The typical (median) path of an even number of fair flips has exactly half
// heads, so its growth per flip is the average of log(heads factor) and
// log(tails factor). The candidate with the biggest growth wins.
function logGrowth(f, u, d) {
  return 0.5 * Math.log(1 + u * f) + 0.5 * Math.log(1 - d * f);
}

function binomialCdfHalf(n, k) {
  let total = 0;
  let c = 1; // n choose 0
  for (let i = 0; i <= k; i++) {
    total += c;
    c = (c * (n - i)) / (i + 1);
  }
  return total / 2 ** n;
}

function solve(game) {
  const u = game.upPct / 100;
  const d = game.downPct / 100;
  const T = game.horizonYears;
  const growth = game.candidateFractions.map((f) => logGrowth(f, u, d));
  const f = game.candidateFractions[growth.indexOf(Math.max(...growth))];
  const medianFinalBalance = game.buyIn * Math.exp(T * logGrowth(f, u, d));
  // P(ending below the buy-in): the share of heads counts that lose money.
  let maxLosingHeads = -1;
  for (let h = 0; h <= T; h++) {
    if (h * Math.log(1 + u * f) + (T - h) * Math.log(1 - d * f) < 0) maxLosingHeads = h;
  }
  const probLoss = maxLosingHeads < 0 ? 0 : binomialCdfHalf(T, maxLosingHeads);
  return { recommendedFraction: f, medianFinalBalance, probLoss };
}

// ── Grading helpers (mirror the platform's tolerances) ──────────────────────
function asNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Returns null when the answer would pass the battery, else the reason. */
function grade(game, answer) {
  const truth = solve(game);
  const fraction = asNumber(answer?.recommendedFraction);
  const median = asNumber(answer?.medianFinalBalance);
  const pLoss = asNumber(answer?.probLoss);
  if (fraction === null) return "no numeric `recommendedFraction` in your response";
  if (median === null) return "no numeric `medianFinalBalance` in your response";
  if (pLoss === null) return "no numeric `probLoss` in your response";
  if (typeof answer.reasoning !== "string" || answer.reasoning.trim().length < 10) {
    return "`reasoning` must be a short plain-language sentence (a string)";
  }
  if (!game.candidateFractions.some((f) => Math.abs(f - fraction) < 1e-9)) {
    return `recommendedFraction ${fraction} is not one of the candidates ${JSON.stringify(game.candidateFractions)}`;
  }
  if (Math.abs(fraction - truth.recommendedFraction) > 1e-9) {
    return `recommendedFraction is ${fraction}, correct is ${truth.recommendedFraction} (pick the candidate with the highest MEDIAN, not the highest mean)`;
  }
  const medianTol = Math.max(1, truth.medianFinalBalance * MEDIAN_REL_TOLERANCE);
  if (Math.abs(median - truth.medianFinalBalance) > medianTol) {
    return `medianFinalBalance is ${Math.round(median)}, correct is about ${Math.round(truth.medianFinalBalance)} (tolerance \u00b15%)`;
  }
  if (Math.abs(pLoss - truth.probLoss) > PROB_LOSS_TOLERANCE) {
    return `probLoss is ${pLoss.toFixed(3)}, correct is about ${truth.probLoss.toFixed(3)} (tolerance \u00b1${PROB_LOSS_TOLERANCE})`;
  }
  return null;
}

// ── Send the three samples ──────────────────────────────────────────────────
console.log(`\nTry-simulator against ${siteUrl}\n`);
let failures = 0;

for (const game of SAMPLES) {
  let res;
  const started = Date.now();
  try {
    res = await fetch(`${siteUrl}/api/simulator/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.log(
      timedOut
        ? `  \u2717 ${game.probeId}: no answer within 10 seconds. The grader gives up at 10 seconds too; check N_PATHS in your decide route`
        : `  \u2717 ${game.probeId}: could not connect. Is the dev server running at ${siteUrl}?`
    );
    failures++;
    continue;
  }
  const seconds = (Date.now() - started) / 1000;

  if (res.status === 501) {
    console.log(
      `  \u2717 ${game.probeId}: 501 Not Implemented. src/app/api/simulator/decide/route.ts is still the placeholder (Step 4 of the build guide replaces it)`
    );
    failures++;
    continue;
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (body?.error) detail = `: ${body.error}`;
    } catch {
      // not JSON; the status code is all we have
    }
    console.log(`  \u2717 ${game.probeId}: HTTP ${res.status} from POST /api/simulator/decide${detail}`);
    failures++;
    continue;
  }

  let answer = null;
  try {
    answer = await res.json();
  } catch {
    console.log(`  \u2717 ${game.probeId}: the response was not valid JSON`);
    failures++;
    continue;
  }

  const truth = solve(game);
  const miss = grade(game, answer);
  const yours = JSON.stringify({
    recommendedFraction: answer.recommendedFraction,
    medianFinalBalance: Math.round(Number(answer.medianFinalBalance)),
    probLoss: Number(Number(answer.probLoss).toFixed(3)),
  });
  const correct = JSON.stringify({
    recommendedFraction: truth.recommendedFraction,
    medianFinalBalance: Math.round(truth.medianFinalBalance),
    probLoss: Number(truth.probLoss.toFixed(3)),
  });
  if (miss === null) {
    console.log(`  \u2713 ${game.probeId}: correct (answered in ${seconds.toFixed(1)}s)`);
    console.log(`      yours:   ${yours}`);
    console.log(`      correct: ${correct}`);
    if (seconds > 5) {
      console.log("      (slow: over 5 seconds. The grader allows 10, and Vercel can be slower than your laptop.)");
    }
  } else {
    console.log(`  \u2717 ${game.probeId}: ${miss}`);
    console.log(`      yours:   ${yours}`);
    console.log(`      correct: ${correct}`);
    failures++;
  }
}

console.log("");
if (failures === 0) {
  console.log("All three sample games answered correctly. Your numbers come from a");
  console.log("simulation, so the loss probabilities will be close to the exact answers,");
  console.log("not equal; the grader allows for that. The battery sends 20 games with");
  console.log("fresh numbers.");
  console.log("Next step: npm run selfcheck (it also checks your meta route, your");
  console.log("/simulator page, and your DAG picture).");
  process.exit(0);
} else {
  console.log(
    `${failures} game${failures === 1 ? "" : "s"} failing. Read the reason on each \u2717 line, fix the decide route, and run again: this script is unlimited, the battery is not.`
  );
  process.exit(1);
}