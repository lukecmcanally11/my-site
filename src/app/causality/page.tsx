import { ComingSoon } from "@/components/ComingSoon";
import { StratifiedComparison } from "@/components/causality/StratifiedComparison";
import { loadLatest } from "@/lib/causality-store";

export const metadata = { title: "Causality Audit" };

// Freshness contract: re-render on every request, so the grader never sees
// a cached copy from before your API answered.
export const dynamic = "force-dynamic";

const STRUCTURE_NAMES: Record<string, string> = {
  fork: "a fork (a common cause)",
  pipe: "a pipe (a mediator)",
  collider: "a collider (a common effect)",
  direct: "a direct effect (the third variable is a bystander)",
};

export default async function CausalityPage() {
  const latest = await loadLatest();

  // Until the first probe arrives, keep the honest placeholder.
  if (!latest) {
    return (
      <ComingSoon
        lane={4}
        title="Causality Audit"
        description="A service that tells forks from pipes from colliders, and knows when to stratify. Built after Lane 4."
      />
    );
  }

  const { probe, answer, summary } = latest;
  const ctx = probe.context;
  const structure = String(answer.structure);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        Lane 4 · live causality audit
      </p>
      <h1 className="mt-3 text-4xl font-bold">
        {answer.causal
          ? `Changing ${ctx.xLabel} would change ${ctx.yLabel}`
          : `Changing ${ctx.xLabel} would not change ${ctx.yLabel}`}
      </h1>
      {/* TODO(yours): one sentence, your words, on what this service does. */}
      <p className="mt-4 max-w-prose text-muted">
        This service takes a table plus the story about the third variable, names the structure
        (fork, pipe, collider, or direct), and says whether the gap is a cause or a coincidence.
        Every number here is the same saved answer my API just gave.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">The latest audit</h2>
        <p className="mt-2 max-w-prose text-muted">{String(ctx.narrative)}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">The verdict</h2>
        <ul className="mt-3 space-y-1 text-lg">
          <li>
            Verdict:{" "}
            <strong data-causality="verdict" className="text-accent">
              {answer.causal ? "causal" : "not causal"}
            </strong>
          </li>
          <li>
            Structure:{" "}
            <strong data-causality="structure" className="text-accent">
              {structure}
            </strong>
            <span className="text-base text-muted"> ({STRUCTURE_NAMES[structure] ?? structure})</span>
          </li>
          <li>
            Stratified effect on {String(ctx.yLabel)}:{" "}
            <strong data-causality="stratified-effect" className="text-accent">
              {Number(answer.stratifiedEffect).toFixed(2)}
            </strong>
          </li>
          <li>
            Advice:{" "}
            <strong>{answer.advice === "stratify" ? `compare within each level of ${ctx.zLabel}` : `do not split the data by ${ctx.zLabel}`}</strong>
          </li>
        </ul>
        <p className="mt-3 max-w-prose text-muted">{String(answer.reasoning)}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">The evidence</h2>
        <StratifiedComparison
          summary={summary}
          x0={String(ctx.x0)}
          x1={String(ctx.x1)}
          yLabel={String(ctx.yLabel)}
        />
        {/* TODO(yours): one or two sentences a manager could read: what the
            comparison shows, and why the story about the third variable
            decides which row to trust (Stations 4.4 and 4.5). */}
        <p className="mt-3 max-w-prose text-muted">
          The top row is the overall comparison of {String(ctx.x0)} vs {String(ctx.x1)}. The rows
          below split that same comparison by {String(ctx.zLabel)}. A manager should not pick the
          bigger gap: if {String(ctx.zLabel)} was there first and steered the choice, trust the
          split; if it is how the treatment works, or a bystander, trust the overall row.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">The causal structure</h2>
        <img
          data-causality="dag"
          src={`/images/causality/${structure}.png`}
          alt={`DAG of ${STRUCTURE_NAMES[structure] ?? structure}: X is ${ctx.xLabel}, Z is ${ctx.zLabel}, Y is ${ctx.yLabel}.`}
          className="mt-3 w-full max-w-md rounded-lg border border-line bg-white p-3"
        />
        {/* TODO(yours): one sentence connecting the picture to the verdict:
            which arrow (or missing arrow) makes it causal or not. */}
        <p className="mt-3 max-w-prose text-muted">
          {answer.causal
            ? `This picture is causal because an arrow still runs from ${ctx.xLabel} to ${ctx.yLabel}, either straight or through ${ctx.zLabel}, so changing ${ctx.xLabel} would move the outcome.`
            : `This picture is not causal because there is no arrow from ${ctx.xLabel} to ${ctx.yLabel}: the gap is coming from ${ctx.zLabel}, so changing ${ctx.xLabel} would not move the outcome.`}
        </p>
      </section>
    </main>
  );
}