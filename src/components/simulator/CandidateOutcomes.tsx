import type { CandidateSummary } from "@/lib/simulator-store";

export function CandidateOutcomes({
  candidates,
  buyIn,
  recommended,
}: {
  candidates: CandidateSummary[];
  buyIn: number;
  recommended: number;
}) {
  const values = [buyIn, ...candidates.flatMap((c) => [c.p5, c.p95])].map((v) => Math.max(1, v));
  const lo = Math.log(Math.min(...values));
  const hi = Math.log(Math.max(...values));
  // Position of a dollar amount across the chart, from 0% (left) to 100% (right).
  const pos = (v: number) => ((Math.log(Math.max(1, v)) - lo) / (hi - lo || 1)) * 100;
  const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

  return (
    <figure className="mt-4 rounded-lg border border-line bg-surface p-4">
      <div className="space-y-5">
        {candidates.map((c) => {
          const best = Math.abs(c.fraction - recommended) < 1e-9;
          return (
            <div key={c.fraction}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <span className={best ? "font-bold text-accent" : "font-medium"}>
                  Stake {Math.round(c.fraction * 100)}% each year{best ? " (recommended)" : ""}
                </span>
                <span className="tabular-nums text-muted">
                  typical result {money(c.median)} · {Math.round(c.probLoss * 100)}% end below the
                  buy-in
                </span>
              </div>
              <div className="relative mt-1 h-6 rounded bg-paper">
                <div
                  className="absolute top-2 h-2 rounded bg-accent"
                  style={{ left: `${pos(c.p5)}%`, width: `${pos(c.p95) - pos(c.p5)}%`, opacity: 0.3 }}
                />
                <div
                  className="absolute top-1 h-4 rounded bg-accent"
                  style={{ left: `${pos(c.p25)}%`, width: `${pos(c.p75) - pos(c.p25)}%`, opacity: best ? 0.9 : 0.55 }}
                />
                <div
                  className="absolute top-0 h-6 w-1 rounded bg-ink"
                  style={{ left: `calc(${pos(c.median)}% - 2px)` }}
                />
                <div
                  className="absolute top-0 h-6 border-l-2 border-dashed border-muted"
                  style={{ left: `${pos(buyIn)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs tabular-nums text-muted">
        <span>{money(Math.exp(lo))}</span>
        <span>dashed line: the {money(buyIn)} buy-in</span>
        <span>{money(Math.exp(hi))}</span>
      </div>
      <figcaption className="mt-3 text-sm text-muted">
        Each row is one candidate stake, simulated thousands of times. The thin bar covers the middle
        90% of simulated investors, the thick bar the middle 50%, and the dark tick is the typical
        investor (the median). The recommended stake is the row whose tick sits farthest to the
        right. Larger stakes stretch the bars wider in both directions: a few investors do very well,
        and the typical one does worse.
      </figcaption>
    </figure>
  );
}