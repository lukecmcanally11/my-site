#!/usr/bin/env node
/**
 * npm run try-causality [-- <url>]
 *
 * Challenge 4 practice runs, without spending a battery run. Generates eight
 * fresh sample probes (two from each hidden structure: fork, pipe, collider,
 * direct), sends them to YOUR /api/causality/decide (local dev server by
 * default), and prints your answer next to the correct one:
 *
 *   npm run try-causality                                  # local dev server
 *   npm run try-causality -- https://your-site.vercel.app  # deployed site
 *
 * The real battery is limited to 3 runs per 24 hours. This script is
 * unlimited: make it green first, then spend a run.
 *
 * Like selfcheck, this is a small, deliberate reimplementation of the
 * course grader (course-platform/src/lib/challenges/causality.ts and
 * src/lib/causal-math.ts): the same data-generating processes, the same
 * guards that keep every dataset decisive, and the same grading rules.
 * If the wire contract evolves, re-sync by hand.
 */

const siteUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const TIMEOUT_MS = 10_000;
const EFFECT_TOLERANCE = 0.05;
const VISIBLE = 0.35;

// ── A small seeded random-number generator (fresh seed every run) ──────────
let state = (Date.now() ^ 0x9e3779b9) >>> 0;
function rand() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const uniform = (a, b) => a + (b - a) * rand();
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
function normal(sd = 1) {
  const u1 = Math.max(rand(), 1e-12);
  return sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());
}
const round3 = (v) => Math.round(v * 1000) / 1000;

// ── The four data-generating processes (as in causal-math.ts) ──────────────
function drawRows(structure, n, baseY, sign, forkFlavor) {
  const rows = [];
  if (structure === "fork") {
    const zEffect = sign * uniform(1.8, 2.6);
    const direct = forkFlavor === "causal" ? -sign * uniform(1.1, 1.7) : 0;
    const p0 = uniform(0.72, 0.8);
    const p1 = uniform(0.2, 0.28);
    for (let i = 0; i < n; i++) {
      const z = rand() < 0.5 ? 1 : 0;
      const x = rand() < (z === 1 ? p1 : p0) ? 1 : 0;
      rows.push({ x, z, y: round3(baseY + zEffect * z + direct * x + normal()) });
    }
  } else if (structure === "pipe") {
    const zEffect = sign * uniform(1.8, 2.6);
    const p1 = uniform(0.76, 0.84);
    const p0 = uniform(0.16, 0.24);
    for (let i = 0; i < n; i++) {
      const x = rand() < 0.5 ? 1 : 0;
      const z = rand() < (x === 1 ? p1 : p0) ? 1 : 0;
      rows.push({ x, z, y: round3(baseY + zEffect * z + normal()) });
    }
  } else if (structure === "collider") {
    const a = uniform(1.3, 1.7);
    const b = sign * uniform(1.3, 1.7);
    for (let i = 0; i < n; i++) {
      const x = rand() < 0.5 ? 1 : 0;
      const yDev = normal();
      const z = a * (x - 0.5) + b * yDev + normal(0.6) > 0 ? 1 : 0;
      rows.push({ x, z, y: round3(baseY + yDev) });
    }
  } else {
    const effect = sign * uniform(1.0, 1.8);
    for (let i = 0; i < n; i++) {
      const x = rand() < 0.5 ? 1 : 0;
      const z = rand() < 0.5 ? 1 : 0;
      rows.push({ x, z, y: round3(baseY + effect * x + normal()) });
    }
  }
  return rows;
}

const mean = (ys) => ys.reduce((a, b) => a + b, 0) / ys.length;
function naiveEffect(rows) {
  return mean(rows.filter((r) => r.x === 1).map((r) => r.y)) - mean(rows.filter((r) => r.x === 0).map((r) => r.y));
}
function stratifiedEffect(rows) {
  let weighted = 0;
  for (const z of [0, 1]) {
    const slice = rows.filter((r) => r.z === z);
    weighted += naiveEffect(slice) * slice.length;
  }
  return weighted / rows.length;
}
function minCell(rows) {
  let m = Infinity;
  for (const z of [0, 1]) for (const x of [0, 1]) m = Math.min(m, rows.filter((r) => r.z === z && r.x === x).length);
  return m;
}
function guardsHold(structure, flavor, naive, strat) {
  const a = Math.abs(naive);
  const s = Math.abs(strat);
  if (structure === "fork") {
    const visible = a >= 0.6 && Math.abs(naive - strat) >= 0.4;
    return flavor === "causal" ? visible && s >= 0.6 : visible && s <= 0.15;
  }
  if (structure === "pipe") return a >= 0.6 && s <= 0.15;
  if (structure === "collider") return a <= 0.15 && s >= 0.6;
  return a >= 0.6 && s >= 0.6 && Math.abs(naive - strat) <= 0.15;
}

// ── Sample stories (the grader uses others; the facts work the same way) ───
const STORIES = {
  fork: {
    xLabel: "surgeon", x0: "Doc Dreamy", x1: "Doc Duck",
    zLabel: "severity", z0: "high", z1: "low", yLabel: "symptom score",
    narrative: "A hospital asks which surgeon produces better outcomes. Patient severity exists before the choice of surgeon, and severe cases go to whoever can operate soonest.",
    domainFacts: { zTiming: "before-x", zInfluencesX: true },
  },
  pipe: {
    xLabel: "treatment", x0: "unsprayed", x1: "sprayed",
    zLabel: "fungus", z0: "present", z1: "absent", yLabel: "growth (cm)",
    narrative: "A greenhouse randomized plots to pesticide or none. Fungus was recorded mid-season, after spraying; the pesticide works by killing fungus.",
    domainFacts: { zTiming: "after-x", zInfluencesX: false },
  },
  collider: {
    xLabel: "interview", x0: "ordinary", x1: "standout",
    zLabel: "offer", z0: "no", z1: "yes", yLabel: "reference score",
    narrative: "A recruiting team asks whether standout interviewers have weaker references. Offers are decided after interviews and reference checks, based on both.",
    domainFacts: { zTiming: "after-x", zInfluencesX: false },
  },
  direct: {
    xLabel: "checkoutFlow", x0: "old", x1: "new",
    zLabel: "device", z0: "desktop", z1: "mobile", yLabel: "basket size ($)",
    narrative: "An online store A/B tested a new checkout flow with random assignment. Device type is a logging field: it did not influence assignment and does not respond to the flow.",
    domainFacts: { zTiming: "before-x", zInfluencesX: false },
  },
};

function makeProbe(structure, index, forkFlavor) {
  const sign = pick([1, -1]);
  const baseY = Math.floor(uniform(10, 61));
  for (let attempt = 0; ; attempt++) {
    const rows = drawRows(structure, 240, baseY, sign, forkFlavor);
    const naive = naiveEffect(rows);
    const strat = stratifiedEffect(rows);
    if ((minCell(rows) >= 15 && guardsHold(structure, forkFlavor, naive, strat)) || attempt > 400) {
      const s = STORIES[structure];
      const causal =
        structure === "pipe" || structure === "direct" ? true : structure === "fork" ? Math.abs(strat) >= VISIBLE : false;
      return {
        probe: {
          probeId: `try-audit-${index}`,
          type: "causality-audit",
          context: { ...s },
          candidateDAGs: [
            { structure: "fork", edges: [`${s.zLabel} -> ${s.xLabel}`, `${s.zLabel} -> outcome`, `${s.xLabel} -> outcome (maybe)`] },
            { structure: "pipe", edges: [`${s.xLabel} -> ${s.zLabel}`, `${s.zLabel} -> outcome`] },
            { structure: "collider", edges: [`${s.xLabel} -> ${s.zLabel}`, `outcome -> ${s.zLabel}`] },
            { structure: "direct", edges: [`${s.xLabel} -> outcome`] },
          ],
          dataset: rows,
        },
        truth: {
          structure,
          causal,
          advice: structure === "fork" ? "stratify" : "do-not-stratify",
          stratifiedEffect: strat,
        },
      };
    }
  }
}

// ── Grading (mirrors the platform's rules) ─────────────────────────────────
function grade(truth, ans) {
  const structures = ["fork", "pipe", "collider", "direct"];
  if (!structures.includes(ans?.structure)) return `\`structure\` must be one of ${JSON.stringify(structures)}`;
  if (typeof ans.causal !== "boolean") return "`causal` must be true or false";
  if (!["stratify", "do-not-stratify", "randomize"].includes(ans.advice)) {
    return '`advice` must be "stratify" or "do-not-stratify"';
  }
  const effect = typeof ans.stratifiedEffect === "number" ? ans.stratifiedEffect : Number(ans.stratifiedEffect);
  if (!Number.isFinite(effect)) return "`stratifiedEffect` must be a number";
  if (typeof ans.reasoning !== "string" || ans.reasoning.trim().length < 10) {
    return "`reasoning` must be a short plain-language sentence";
  }
  if (ans.structure !== truth.structure) {
    return `structure is "${ans.structure}", correct is "${truth.structure}" (check classifyStructure against the rule table in Step 4c)`;
  }
  if (ans.causal !== truth.causal) return `causal is ${ans.causal}, correct is ${truth.causal}`;
  const adviceOk = truth.advice === "stratify" ? ans.advice !== "do-not-stratify" : ans.advice === "do-not-stratify";
  if (!adviceOk) return `advice is "${ans.advice}", correct is "${truth.advice}"`;
  if (truth.structure === "fork" && Math.abs(effect - truth.stratifiedEffect) > EFFECT_TOLERANCE) {
    return `stratifiedEffect is ${effect.toFixed(3)}, correct is ${truth.stratifiedEffect.toFixed(3)} (tolerance \u00b1${EFFECT_TOLERANCE})`;
  }
  return null;
}

// ── Send the eight samples ─────────────────────────────────────────────────
const samples = [
  makeProbe("fork", 1, "pure-confound"),
  makeProbe("pipe", 2),
  makeProbe("collider", 3),
  makeProbe("direct", 4),
  makeProbe("fork", 5, "causal"),
  makeProbe("collider", 6),
  makeProbe("pipe", 7),
  makeProbe("direct", 8),
];

console.log(`\nTry-causality against ${siteUrl}\n`);
let failures = 0;

for (const { probe, truth } of samples) {
  let res;
  const started = Date.now();
  try {
    res = await fetch(`${siteUrl}/api/causality/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(probe),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.log(
      timedOut
        ? `  \u2717 ${probe.probeId}: no answer within 10 seconds`
        : `  \u2717 ${probe.probeId}: could not connect. Is the dev server running at ${siteUrl}?`
    );
    failures++;
    continue;
  }
  const seconds = (Date.now() - started) / 1000;

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (body?.error) detail = `: ${body.error}`;
    } catch {
      // not JSON; the status code is all we have
    }
    const hint =
      res.status === 501 && !detail
        ? " (src/app/api/causality/decide/route.ts is still the placeholder; Step 4 of the build guide replaces it)"
        : "";
    console.log(`  \u2717 ${probe.probeId}: HTTP ${res.status} from POST /api/causality/decide${detail}${hint}`);
    failures++;
    continue;
  }

  let answer = null;
  try {
    answer = await res.json();
  } catch {
    console.log(`  \u2717 ${probe.probeId}: the response was not valid JSON`);
    failures++;
    continue;
  }

  const miss = grade(truth, answer);
  const yours = JSON.stringify({
    structure: answer.structure,
    causal: answer.causal,
    advice: answer.advice,
    stratifiedEffect: Number(Number(answer.stratifiedEffect).toFixed(3)),
  });
  const correct = JSON.stringify({
    structure: truth.structure,
    causal: truth.causal,
    advice: truth.advice,
    stratifiedEffect: Number(truth.stratifiedEffect.toFixed(3)),
  });
  if (miss === null) {
    console.log(`  \u2713 ${probe.probeId} (${truth.structure}): correct (answered in ${seconds.toFixed(1)}s)`);
  } else {
    console.log(`  \u2717 ${probe.probeId}: ${miss}`);
    failures++;
  }
  console.log(`      yours:   ${yours}`);
  console.log(`      correct: ${correct}`);
}

console.log("");
if (failures === 0) {
  console.log("All eight sample probes answered correctly. Every run draws fresh");
  console.log("datasets, so run it a few times. The battery sends 24 (six per structure).");
  console.log("Next step: npm run selfcheck (it also checks your meta route, your");
  console.log("/causality page, and your DAG picture).");
  process.exit(0);
} else {
  console.log(
    `${failures} probe${failures === 1 ? "" : "s"} failing. Read the reason on each \u2717 line, fix the decide route, and run again: this script is unlimited, the battery is not.`
  );
  process.exit(1);
}