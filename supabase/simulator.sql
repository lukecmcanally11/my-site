create table public.simulator_latest (
  key text primary key,
  problem jsonb not null,
  answer jsonb not null,
  candidates jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.simulator_latest enable row level security;

create policy "anyone can read" on public.simulator_latest
  for select using (true);
create policy "anyone can insert" on public.simulator_latest
  for insert with check (true);
create policy "anyone can update" on public.simulator_latest
  for update using (true);

grant select, insert, update on public.simulator_latest to anon;