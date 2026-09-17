-- Optional: wenn Storage-JSON später in Postgres wandert.
-- BrewAI-Prod (lutmsbxcjmocftiovwfs) — lokal/MCP war zeitweise ein anderes Projekt.
begin;
create table if not exists public.dashboard_characters (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null default 0 check (position >= 0 and position < 16),
  item jsonb not null check (jsonb_typeof(item) = 'object'),
  primary key (user_id, id)
);
alter table public.dashboard_characters enable row level security;
drop policy if exists "No client access to dashboard characters" on public.dashboard_characters;
create policy "No client access to dashboard characters" on public.dashboard_characters for all to public using (false) with check (false);
revoke all on public.dashboard_characters from public, anon, authenticated;
grant all on public.dashboard_characters to service_role;
commit;
