import { profile } from "@/profile";

export const metadata = { title: `About — ${profile.displayName}` };

/**
 * The human-facing twin of /api/profile. Because both read from
 * src/profile.ts, they agree by construction, which is exactly what the
 * course's "/about matches the API" check verifies.
 */
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex flex-col gap-10 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.photoPath}
          alt={profile.displayName}
          className="h-56 w-56 shrink-0 rounded-2xl border border-line object-cover"
        />
        <div>
          <h1 className="text-4xl font-bold">{profile.displayName}</h1>
          <p className="mt-2 text-lg text-muted">
            From <span className="font-semibold text-ink">{profile.hometown}</span>
          </p>
          <p className="mt-5 max-w-prose">{profile.bio}</p>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">A few fun facts</h2>
        <ul className="mt-4 space-y-2">
          {profile.funFacts.map((fact) => (
            <li key={fact} className="flex gap-3">
              <span aria-hidden className="mt-1 text-accent">
                ✦
              </span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-xl font-bold">A decision I&apos;m proud of</h2>
        <p className="mt-3 max-w-prose italic text-muted">
          &ldquo;{profile.decisionImProudOf}&rdquo;
        </p>
      </section>
    </main>
  );
}
