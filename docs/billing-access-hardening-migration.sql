-- Emergency hardening for the existing BrewAI billing schema.
-- All billing writes and reads go through server routes using service_role.
begin;

alter table public.billing_subscriptions enable row level security;
alter table public.billing_token_pack_grants enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.invites enable row level security;

drop policy if exists "users can read own billing row" on public.billing_subscriptions;
drop policy if exists "users can update own billing row" on public.billing_subscriptions;

revoke all on table
  public.billing_subscriptions,
  public.billing_token_pack_grants,
  public.stripe_webhook_events,
  public.invites
from public, anon, authenticated;

grant all on table
  public.billing_subscriptions,
  public.billing_token_pack_grants,
  public.stripe_webhook_events,
  public.invites
to service_role;

revoke all on function public.add_monthly_tokens_atomic(uuid, integer)
from public, anon, authenticated;
grant execute on function public.add_monthly_tokens_atomic(uuid, integer) to service_role;

commit;
