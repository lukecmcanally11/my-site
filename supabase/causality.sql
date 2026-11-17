-- The causality auditor's memory (Challenge 4). You run this ONCE, right
-- before you build the service: Supabase dashboard -> SQL Editor -> New
-- query -> paste this whole file -> Run. Expect "Success. No rows returned."
-- The build guide (course book, end of Lane 4) explains every line.

-- One row, always named "latest". Each time your /api/causality/decide
-- answers a probe, it overwrites this row with the newest probe's story
-- (without its 240 data rows), your newest answer, and a short summary of
-- the data: the group averages overall and within each level of the third
-- variable (the numbers your page's chart draws).

create table public.causality_latest (
  key text primary key,
  probe jsonb not null,
  answer jsonb not null,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security, same idea as the other three tables: anyone may read
-- (your /causality page is public), and anyone may write (your API route
-- saves each answer as it happens).
alter table public.causality_latest enable row level security;

create policy "anyone can read" on public.causality_latest
  for select using (true);
create policy "anyone can insert" on public.causality_latest
  for insert with check (true);
create policy "anyone can update" on public.causality_latest
  for update using (true);

-- The grant: the policies say which rows, the grant lets the "anon" role
-- (the publishable key, no sign-in) use the table at all. Both are
-- required. Without it, every request fails with "permission denied for
-- table causality_latest".
grant select, insert, update on public.causality_latest to anon;