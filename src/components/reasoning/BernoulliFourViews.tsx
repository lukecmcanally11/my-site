export function BernoulliFourViews({
    theta,
    onSuccess,
    onFailure,
  }: {
    theta: number;
    onSuccess: number;
    onFailure: number;
  }) {
    const p1 = theta;
    const p0 = 1 - theta;
    const box = "rounded-lg border border-line bg-surface p-4";
    const label = "text-xs font-semibold uppercase tracking-widest text-muted";
  
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* View 1: the table */}
        <div className={box}>
          <p className={label}>Table view</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Outcome x</th>
                <th className="py-1 font-medium">Payoff</th>
                <th className="py-1 font-medium">P(X = x)</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr>
                <td className="py-1">1</td>
                <td className="py-1">${onSuccess}</td>
                <td className="py-1">{p1.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-1">0</td>
                <td className="py-1">${onFailure}</td>
                <td className="py-1">{p0.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
  
        {/* View 2: the math */}
        <div className={box}>
          <p className={label}>Math view</p>
          <p className="mt-3 text-lg">
            X ~ Bernoulli(θ), &nbsp;θ = {p1.toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-muted">
            P(X = 1) = {p1.toFixed(2)}, &nbsp;P(X = 0) = {p0.toFixed(2)}
          </p>
        </div>
  
        {/* View 3: the graph (two bars sized by probability) */}
        <div className={box}>
          <p className={label}>Graph view</p>
          <div className="mt-3 space-y-2 text-sm">
            {[
              { x: "1", p: p1 },
              { x: "0", p: p0 },
            ].map(({ x, p }) => (
              <div key={x} className="flex items-center gap-2">
                <span className="w-10 shrink-0 tabular-nums text-muted">x = {x}</span>
                <div className="h-5 flex-1 rounded bg-paper">
                  <div
                    className="h-5 rounded bg-accent"
                    style={{ width: `${Math.round(p * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums">{p.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
  
        {/* View 4: the node (the DAG seed from Station 2.4) */}
        <div className={box}>
          <p className={label}>Node view</p>
          <svg viewBox="0 0 160 80" className="mt-2 h-20 w-full" role="img" aria-label="X as a node">
            <ellipse
              cx="80"
              cy="40"
              rx="42"
              ry="26"
              className="fill-none stroke-current"
              strokeWidth="2"
            />
            <text x="80" y="46" textAnchor="middle" className="fill-current text-lg font-semibold">
              X
            </text>
          </svg>
          <p className="text-center text-sm text-muted">
            One uncertain quantity, one node. In Lane 3, nodes get parents.
          </p>
        </div>
      </div>
    );
  }