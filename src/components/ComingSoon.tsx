import Link from "next/link";

/**
 * The placeholder page for a not-yet-built decision service. When you take
 * on the lane's challenge, replace the page that renders this with your
 * real service page (the challenge's page check reads data-* attributes;
 * see the challenge brief on the course platform).
 */
export function ComingSoon({
  lane,
  title,
  description,
}: {
  lane: number;
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        Lane {lane} · coming soon
      </p>
      <h1 className="mt-3 text-4xl font-bold">{title}</h1>
      <p className="mt-5 max-w-prose text-lg text-muted">{description}</p>
      <div className="mt-8 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        <p>
          This slot fills in when I reach Lane {lane}. The service&apos;s API routes currently
          answer <code className="rounded bg-paper px-1">501 Not Implemented</code>: honestly
          unfinished, not faked.
        </p>
        <p className="mt-3">
          <Link href="/" className="font-semibold text-accent underline">
            ← Back to the portfolio
          </Link>
        </p>
      </div>
    </main>
  );
}
