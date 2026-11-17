import { NextResponse } from "next/server";
import { saveLatest, type GroupMeans } from "@/lib/causality-store";

/**
 * Challenge 4: the causality auditor's brain. Step 4 of the build guide
 * ("Build Your Causality Auditor", end of Lane 4 in the course book)
 * explains every line. Everything here is complete EXCEPT
 * classifyStructure(), which is yours to write (Step 4c).
 */

type Structure = "fork" | "pipe" | "collider" | "direct";
type Row = { x: 0 | 1; z: 0 | 1; y: number };

// The published threshold: an effect of at least 0.35 (either sign) is "real".
const VISIBLE = 0.35;

const mean = (ys: number[]) => ys.reduce((a, b) => a + b, 0) / ys.length;

// Average y for the X = 0 group and the X = 1 group, in one slice of the rows.
function groupMeans(label: string, rows: Row[]): GroupMeans {
  const y0 = rows.filter((r) => r.x === 0).map((r) => r.y);
  const y1 = rows.filter((r) => r.x === 1).map((r) => r.y);
  return { label, n0: y0.length, mean0: mean(y0), n1: y1.length, mean1: mean(y1) };
}

// Naive effect: the X = 1 average minus the X = 0 average, ignoring Z.
function naiveEffect(rows: Row[]): number {
  const g = groupMeans("all", rows);
  return g.mean1 - g.mean0;
}

// Stratified effect: the same difference inside each level of Z, then
// averaged with each level's share of the rows as its weight.
function stratifiedEffect(rows: Row[]): number {
  let weighted = 0;
  for (const z of [0, 1]) {
    const slice = rows.filter((r) => r.z === z);
    const g = groupMeans(`z=${z}`, slice);
    weighted += (g.mean1 - g.mean0) * slice.length;
  }
  return weighted / rows.length;
}

// TODO(yours): Step 4c of the build guide. Return "fork", "pipe",
// "collider", or "direct", using the two facts about Z and the two
// effects. The guide's rule table and worked example show how.
function classifyStructure(
  facts: { zTiming: "before-x" | "after-x"; zInfluencesX: boolean },
  naive: number,
  stratified: number
): Structure | null {
  // Facts first: z existed before x and steered the choice → fork.
  // Numbers alone can look like a pipe (Doc Duck) or a direct effect.
  if (facts.zTiming === "before-x" && facts.zInfluencesX) return "fork";

  const naiveReal = Math.abs(naive) >= VISIBLE;
  const stratifiedReal = Math.abs(stratified) >= VISIBLE;
  if (naiveReal && !stratifiedReal) return "pipe";
  if (!naiveReal && stratifiedReal) return "collider";
  return "direct";
}

export async function POST(req: Request) {
  const probe = await req.json().catch(() => null);
  if (!probe || !Array.isArray(probe.dataset) || !probe.context?.domainFacts) {
    return NextResponse.json(
      { error: "expected a JSON probe with `context.domainFacts` and a `dataset` list" },
      { status: 400 }
    );
  }
  const rows: Row[] = probe.dataset;
  const ctx = probe.context;

  const naive = naiveEffect(rows);
  const stratified = stratifiedEffect(rows);
  const structure = classifyStructure(ctx.domainFacts, naive, stratified);
  if (structure === null) {
    return NextResponse.json(
      { error: "classifyStructure() is not written yet (Step 4c of the build guide)" },
      { status: 501 }
    );
  }

  // The stratify-or-not table (Station 4.4): the verdict and the advice
  // follow from the structure.
  const causal =
    structure === "pipe" || structure === "direct"
      ? true
      : structure === "fork"
        ? Math.abs(stratified) >= VISIBLE
        : false;
  const advice = structure === "fork" ? "stratify" : "do-not-stratify";

  const z = `The third variable (${ctx.zLabel})`;
  const why: Record<Structure, string> = {
    fork: `${z} was set before ${ctx.xLabel} and steered it, so it is a common cause. Comparing within each of its levels blocks that path`,
    pipe: `${z} comes after ${ctx.xLabel}, and the gap disappears within its levels, so it is how ${ctx.xLabel} works. The overall gap is the effect`,
    collider: `${z} comes after both, there is no overall gap, and a gap appears only within its levels, so it is a common effect. Splitting by it creates a false pattern`,
    direct: `${z} did not steer ${ctx.xLabel}, and the gap is the same overall and within its levels, so it is a bystander`,
  };
  const answer = {
    structure,
    causal,
    advice,
    stratifiedEffect: Number(stratified.toFixed(4)),
    reasoning:
      `Naive effect ${naive.toFixed(2)}, stratified effect ${stratified.toFixed(2)}. ` +
      `${why[structure]}. Verdict: ${causal ? "causal" : "not causal"}.`,
  };

  const summary = {
    naive,
    stratified,
    groups: [
      groupMeans("All data", rows),
      groupMeans(`${ctx.zLabel}: ${ctx.z0}`, rows.filter((r) => r.z === 0)),
      groupMeans(`${ctx.zLabel}: ${ctx.z1}`, rows.filter((r) => r.z === 1)),
    ],
  };
  // Save the story without its 240 rows; the summary holds what the page needs.
  await saveLatest({ ...probe, dataset: undefined }, answer, summary);

  return NextResponse.json(answer);
}