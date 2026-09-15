begin;
create table if not exists public.dashboard_beers (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null default 0 check (position >= 0 and position < 64),
  item jsonb not null check (jsonb_typeof(item) = 'object'),
  primary key (user_id, id)
);
alter table public.dashboard_beers enable row level security;
drop policy if exists "No client access to dashboard beers" on public.dashboard_beers;
create policy "No client access to dashboard beers" on public.dashboard_beers for all to public using (false) with check (false);
revoke all on public.dashboard_beers from public, anon, authenticated;
grant all on public.dashboard_beers to service_role;

create schema if not exists brewai_release_backup_20260915;
create table if not exists brewai_release_backup_20260915.auth_dashboard_beers_metadata (
  user_id uuid primary key, my_beers jsonb not null, backed_up_at timestamptz not null default now()
);
insert into brewai_release_backup_20260915.auth_dashboard_beers_metadata (user_id, my_beers)
select id, raw_user_meta_data->'dashboard'->'myBeers' from auth.users
where jsonb_typeof(raw_user_meta_data->'dashboard'->'myBeers') = 'array'
on conflict (user_id) do nothing;

insert into public.dashboard_beers (user_id, id, position, item)
select u.id, beer.item->>'id', beer.ordinality - 1, beer.item from auth.users u
cross join lateral jsonb_array_elements(u.raw_user_meta_data->'dashboard'->'myBeers') with ordinality as beer(item, ordinality)
where jsonb_typeof(u.raw_user_meta_data->'dashboard'->'myBeers') = 'array' and beer.ordinality <= 64
  and jsonb_typeof(beer.item) = 'object' and nullif(beer.item->>'id', '') is not null
on conflict (user_id, id) do update set position = excluded.position, item = excluded.item;

update auth.users set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{dashboard}',
  coalesce(raw_user_meta_data->'dashboard', '{}'::jsonb) - 'myBeers')
where raw_user_meta_data->'dashboard' ? 'myBeers';
commit;
