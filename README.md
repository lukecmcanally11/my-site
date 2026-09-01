# Your Decision Services Site

This is your site for **Good Decisions at Any Scale**: the one you deploy in
Station 1.3 and keep alive all semester. It starts out working: fill in your
name and env vars and every Challenge 1 check passes. Every later challenge
plugs into a clearly-marked slot.

**Get your copy:** on
[github.com/flyaflya/gdaas-student-template](https://github.com/flyaflya/gdaas-student-template),
click **Use this template → Create a new repository**, name it `my-site`,
make it **Public**, then clone your new repo to your machine. Chapter 3 of
the course book walks through every step.

**You edit two files.** Everything else is wiring you can read but don't need
to touch (yet):

| File | What it controls |
|---|---|
| `src/profile.ts` | Who you are: name, email, hometown, fun facts, photo. Flows to your home page, `/about`, `/api/whoami`, and `/api/profile` automatically, so pages and APIs can never disagree. |
| `src/theme.ts` | How your site looks. Pick a palette, a font pairing, and an optional accent color, no CSS required. See [THEME.md](./THEME.md). |

## Setup (once)

1. **Install and run.** You need [Node.js](https://nodejs.org) (LTS). Then:

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000. The site works immediately (the guestbook
   nudges you until the database step below).

2. **Make it yours.** Open `src/profile.ts`, replace every placeholder, and
   put a real photo of yourself in `public/` (e.g. `public/photo.jpg`, then
   set `photoPath: "/photo.jpg"`). Watch the site update live.

3. **Your site token.** Copy `.env.example` to `.env.local` and set
   `SITE_TOKEN`, copied **exactly** from the course platform's
   Register-site page. Your `/api/health` echoes it so the course prober
   knows this site is yours. Restart `npm run dev` after editing
   `.env.local`.

## Deploy and register (Chapter 3 walks through this)

1. If you used **Use this template**, your GitHub repo already exists and
   your clone knows where it lives, so a plain `git push` sends commits
   there. (Built from scratch instead? Push your project to a new public
   repo of your own.)
2. Set `repoUrl` in `src/profile.ts` to your repo's URL (e.g.
   `https://github.com/your-username/your-repo`). The course grader reads it
   from `/api/health` and checks you have ≥ 5 commits spread over days, not
   one bulk dump. Commit early and often so this is free by Challenge 1.
3. In [Vercel](https://vercel.com): **Add New → Project**, import your repo,
   deploy. You get a `something.vercel.app` URL.
4. In Vercel: **Settings → Environment Variables**, add `SITE_TOKEN` with
   the same value as your `.env.local`, then redeploy (env vars are read at
   deploy time).
5. Register your Vercel URL on the course platform's Register-site page. A
   green probe masters Station 1.3.

## Connect your database (Chapter 3, Step 5)

1. Create a free project at [Supabase](https://supabase.com).
2. In your Supabase project: **SQL Editor → New query**, paste the contents
   of [`supabase/guestbook.sql`](./supabase/guestbook.sql), Run. That
   creates the guestbook table (Chapter 4 explains every line).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
   `.env.local`. Both are in the Supabase dashboard under **Settings →
   API Keys** (use the publishable key). Restart `npm run dev`.
4. Add the same two variables in Vercel's Environment Variables and
   redeploy.

Proof it worked: `/api/health` (local and live) changes from
`"database": "not configured"` to `"database": "connected (0 guestbook
signatures)"`, and the guestbook on your home page comes alive.

## Check yourself before the grader does

```bash
npm run selfcheck                                  # against your local dev server
npm run selfcheck -- https://your-site.vercel.app  # against your deployed site
```

Selfcheck runs the same Challenge 1 checks the course platform grades:
health/token, whoami, profile + photo, personalized home page, `/about`
agreement, guestbook round-trip, and GitHub commit history (≥ 5 commits
spread over at least 24 hours via the `repoUrl` you declare in
`src/profile.ts`), with plain-language diagnostics per check.
It also confirms the later-lane stubs honestly return `501` (they *should*
fail until you build them).

Two things selfcheck can't do: it can't verify that your `/api/whoami` email
matches your course sign-in (only the platform knows that), and it can't
grade beauty: the beauty bonus is the professor's call, made by looking at
your live site. See [THEME.md](./THEME.md).

> Note: these checks are a small, deliberate reimplementation of the course
> platform's grader; this template stands alone and can't import
> from the platform. If the course's checks evolve, `scripts/selfcheck.mjs`
> is re-synced by hand.

## Where each challenge plugs in

The API stubs below return `501 Not Implemented` until you build them:
honestly unfinished, never faked. Each file's header comment says which lane
fills it in; the challenge pages on the course platform publish the wire
contracts (the exact JSON to send and receive) and starter code.

| Challenge | API routes | Page |
|---|---|---|
| 1 — Live Site (works now) | `src/app/api/{health,whoami,profile,guestbook}/route.ts` | `/` and `/about` |
| 2 — Reasoning & Uncertainty | `src/app/api/reasoning/{meta,decide}/route.ts` | `src/app/reasoning/page.tsx` |
| 3 — Decision Simulator | `src/app/api/simulator/{meta,decide}/route.ts` | `src/app/simulator/page.tsx` |
| 4 — Causality Audit | `src/app/api/causality/{meta,decide}/route.ts` | `src/app/causality/page.tsx` |
| 5 — Capstone | `src/app/api/capstone/{meta,decide}/route.ts` | `src/app/capstone/page.tsx` |

## The beauty bonus

The highest grade without it is A-. The professor reviews live sites by hand
and awards the bonus for sites that show *choices*: a distinctive but
coherent palette, typography picked on purpose, real imagery. This template
is tasteful out of the box, but out-of-the-box is exactly what the bonus
isn't for. `src/theme.ts` and [THEME.md](./THEME.md) exist so you can make
real choices without learning CSS.
