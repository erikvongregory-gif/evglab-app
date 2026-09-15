-- Apply after billing-schema.sql, stripe-webhook-events-schema.sql and billing-atomic-migration.sql.
begin;
create table if not exists public.dashboard_media (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  item jsonb not null,
  primary key(user_id, id)
);
create table if not exists public.integration_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  secret jsonb not null,
  primary key(user_id, provider)
);
alter table public.dashboard_media enable row level security;
alter table public.integration_secrets enable row level security;
revoke all on public.dashboard_media, public.integration_secrets from public, anon, authenticated;
grant all on public.dashboard_media, public.integration_secrets to service_role;
commit;
