create table if not exists public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  best integer not null default 0 check (best >= 0),
  games integer not null default 0 check (games >= 0),
  total integer not null default 0 check (total >= 0),
  muted boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.player_stats enable row level security;

grant select, insert, update on table public.player_stats to authenticated;

create policy "Players can read their own stats" on public.player_stats
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Players can create their own stats" on public.player_stats
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Players can update their own stats" on public.player_stats
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
