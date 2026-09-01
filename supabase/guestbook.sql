-- The guestbook table. You run this ONCE in Station 1.3 (Chapter 3, Step 5):
-- SQL Editor -> New query -> paste -> Run. It creates the table your
-- guestbook (and /api/health's signature count) reads. Chapter 4 walks
-- through what every line means.

create table public.guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Row-level security: who may do what. A public guestbook lets anyone read
-- and sign; your later tables will be far stingier.
alter table public.guestbook enable row level security;

create policy "anyone can read" on public.guestbook
  for select using (true);
create policy "anyone can sign" on public.guestbook
  for insert with check (true);
