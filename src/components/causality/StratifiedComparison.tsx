import type { CausalitySummary } from "@/lib/causality-store";

/**
 * The audit's evidence in one picture: the gap between the two X groups in
 * all the data, then inside each level of Z. Each row puts the two group
 * averages on the same axis, so a reader can see whether the gap survives,
 * vanishes, or appears when you compare like with like.
 */
export function StratifiedComparison({
  summary,
  x0,
  x1,
  yLabel,
}: {
  summary: CausalitySummary;
  x0: string;
  x1: string;
  yLabel: string;
}) {
  const values = summary.groups.flatMap((g) => [g.mean0, g.mean1]);
  const pad = Math.max(0.5, (Math.max(...values) - Math.min(...values)) * 0.25);
  const lo = Math.min(...values) - pad;
  const hi = Math.max(...values) + pad;
  // Position of an average across the chart, from 0% (left) to 100% (right).
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const fmt = (v: number) => v.toFixed(2);

  return (
    <figure className="mt-4 rounded-lg border border-line bg-surface p-4">
      <div className="space-y-6">
        {summary.groups.map((g, i) => {
          const gap = g.mean1 - g.mean0;
          return (
            <div key={g.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <span className={i === 0 ? "font-bold" : "font-medium"}>{g.label}</span>
                <span className="tabular-nums text-muted">
                  gap {gap >= 0 ? "+" : ""}
                  {fmt(gap)} ({g.n0 + g.n1} rows)
                </span>
              </div>
              <div className="relative mt-1 h-8 rounded bg-paper">
                <div
                  className="absolute top-3.5 h-1 rounded bg-accent"
                  style={{
                    left: `${Math.min(pos(g.mean0), pos(g.mean1))}%`,
                    width: `${Math.abs(pos(g.mean1) - pos(g.mean0))}%`,
                    opacity: 0.5,
                  }}
                />
                <div
                  className="absolute top-1.5 h-5 w-5 rounded-full border-2 border-ink bg-paper"
                  style={{ left: `calc(${pos(g.mean0)}% - 10px)` }}
                  title={`${x0}: ${fmt(g.mean0)}`}
                />
                <div
                  className="absolute top-1.5 h-5 w-5 rounded-full bg-accent"
                  style={{ left: `calc(${pos(g.mean1)}% - 10px)` }}
                  title={`${x1}: ${fmt(g.mean1)}`}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
                <span>
                  open circle: {x0} ({g.n0}), average {fmt(g.mean0)}
                </span>
                <span>
                  filled circle: {x1} ({g.n1}), average {fmt(g.mean1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-4 text-sm text-muted">
        Average {yLabel} for each group. The top row is the naive comparison (all the data, gap{" "}
        {fmt(summary.naive)}). The two rows below compare like with like, inside each level of the
        third variable; their gaps, weighted by size, give the stratified effect (
        {fmt(summary.stratified)}). Whether you should trust the top row or the bottom two depends
        on the structure, not on which gap is bigger.
      </figcaption>
    </figure>
  );
}