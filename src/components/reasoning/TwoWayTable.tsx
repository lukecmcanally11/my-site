export function TwoWayTable({
  baseRate,
  hitRate,
  falseAlarmRate,
}: {
  baseRate: number;
  hitRate: number;
  falseAlarmRate: number;
}) {
  const N = 10_000;
  const trueFlagged = Math.round(N * baseRate * hitRate);
  const trueMissed = Math.round(N * baseRate * (1 - hitRate));
  const falseFlagged = Math.round(N * (1 - baseRate) * falseAlarmRate);
  const truePassed = Math.round(N * (1 - baseRate) * (1 - falseAlarmRate));
  const flaggedTotal = trueFlagged + falseFlagged;

  const cell = "border border-line px-3 py-2 text-right tabular-nums";
  const head = "border border-line bg-surface px-3 py-2 text-left font-semibold";

  return (
    <figure className="mt-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={head}>Out of {N.toLocaleString()} cases</th>
            <th className={`${head} text-right`}>Flagged</th>
            <th className={`${head} text-right`}>Not flagged</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${cell} text-left font-medium`}>Actually the condition</td>
            <td className={`${cell} font-bold text-accent`}>{trueFlagged.toLocaleString()}</td>
            <td className={cell}>{trueMissed.toLocaleString()}</td>
          </tr>
          <tr>
            <td className={`${cell} text-left font-medium`}>Not the condition</td>
            <td className={`${cell} font-bold`}>{falseFlagged.toLocaleString()}</td>
            <td className={cell}>{truePassed.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <figcaption className="mt-2 text-sm text-muted">
        The flag arrived, so only the &ldquo;Flagged&rdquo; column matters now:{" "}
        {trueFlagged.toLocaleString()} real cases out of {flaggedTotal.toLocaleString()} flags in
        total. That ratio, {trueFlagged.toLocaleString()} / {flaggedTotal.toLocaleString()}, is the
        posterior. The table is why the number is right.
      </figcaption>
    </figure>
  );
}