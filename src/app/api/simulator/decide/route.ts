import { NextResponse } from "next/server";
import { saveLatest, type CandidateSummary } from "@/lib/simulator-store";

// How many simulated investors per candidate stake. Enough that the answer
// is steady from run to run, few enough to answer well under 10 seconds.
const N_PATHS = 20000;

// One candidate stake, played by nPaths investors. Returns every investor's
// final balance, sorted from smallest to largest.
function simulateGame(
  buyIn: number,
  f: number,
  upPct: number,
  downPct: number,
  years: number,
  nPaths: number
): number[] {
  const up = 1 + (upPct / 100) * f; // what a heads year multiplies the balance by
  const down = 1 - (downPct / 100) * f; // what a tails year multiplies it by
  const finals: number[] = [];
  for (let i = 0; i < nPaths; i++) {
    let balance = buyIn;
    for (let t = 0; t < years; t++) {
      balance *= Math.random() < 0.5 ? up : down;
    }
    finals.push(balance);
  }
  return finals.sort((a, b) => a - b);
}

// The value p of the way along a sorted list: p = 0.5 is the median.
function quantile(sorted: number[], p: number): number {
  return sorted[Math.floor(p * (sorted.length - 1))];
}

export async function POST(req: Request) {
  const game = await req.json().catch(() => null);
  if (!game || !Array.isArray(game.candidateFractions) || game.candidateFractions.length === 0) {
    return NextResponse.json(
      { error: "expected a JSON game with a `candidateFractions` list" },
      { status: 400 }
    );
  }
  const { upPct, downPct, horizonYears, buyIn } = game;

  // Try every candidate stake (the rectangle in the DAG).
  const candidates: CandidateSummary[] = game.candidateFractions.map((f: number) => {
    const finals = simulateGame(buyIn, f, upPct, downPct, horizonYears, N_PATHS);
    return {
      fraction: f,
      p5: quantile(finals, 0.05),
      p25: quantile(finals, 0.25),
      median: quantile(finals, 0.5),
      p75: quantile(finals, 0.75),
      p95: quantile(finals, 0.95),
      probLoss: finals.filter((x) => x < buyIn).length / finals.length,
    };
  });

  // The winner: the candidate whose TYPICAL investor ends with the most.
  let best = candidates[0];
  for (const c of candidates) {
    if (c.median > best.median) best = c;
  }

  const answer = {
    recommendedFraction: best.fraction,
    medianFinalBalance: best.median,
    probLoss: best.probLoss,
    reasoning:
      `Of the ${candidates.length} stakes simulated, staking ${Math.round(best.fraction * 100)}% ` +
      `each year left the typical investor with the most: about ` +
      `$${Math.round(best.median).toLocaleString("en-US")} after ${horizonYears} years, ` +
      `from a $${Number(buyIn).toLocaleString("en-US")} buy-in. ` +
      `${Math.round(best.probLoss * 100)}% of simulated investors still ended below the buy-in.`,
  };

  await saveLatest(game, answer, candidates);

  return NextResponse.json(answer);
}