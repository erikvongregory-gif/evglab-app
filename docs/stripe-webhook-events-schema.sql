-- Run in Supabase SQL Editor
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'processed')),
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (status, created_at desc);

alter table public.stripe_webhook_events enable row level security;

-- Access is server-side only via service role; keep table closed for clients.
drop policy if exists "No client access to stripe_webhook_events" on public.stripe_webhook_events;
create policy "No client access to stripe_webhook_events"
on public.stripe_webhook_events
for all
to authenticated
using (false)
with check (false);

-- ============================================================================
-- Token-Pack-Grants: cross-flow Idempotenz fuer Token-Pack-Kaeufe.
-- Sowohl /api/billing/confirm-session (clientseitig) als auch der Stripe-Webhook
-- versuchen, einen Token-Pack-Kauf gutzuschreiben. Damit es nicht zu Doppel-
-- Gutschriften kommt, claimen sie hier zuerst die session_id; nur der erste
-- Caller darf gutschreiben. Spaetere Calls werden idempotent abgewiesen.
-- ============================================================================
create table if not exists public.billing_token_pack_grants (
  session_id text primary key,
  user_id uuid not null,
  pack_id text not null,
  tokens integer not null check (tokens > 0),
  source text not null check (source in ('confirm_session', 'webhook')),
  granted_at timestamptz not null default now()
);

create index if not exists billing_token_pack_grants_user_idx
  on public.billing_token_pack_grants (user_id, granted_at desc);

alter table public.billing_token_pack_grants enable row level security;

drop policy if exists "No client access to billing_token_pack_grants" on public.billing_token_pack_grants;
create policy "No client access to billing_token_pack_grants"
on public.billing_token_pack_grants
for all
to authenticated
using (false)
with check (false);

-- ============================================================================
-- Atomare Token-Erhoehung. Vermeidet Read-Modify-Write Lost-Updates zwischen
-- parallel laufenden Token-Pack-Buchungen / Plan-Wechseln.
-- ============================================================================
create or replace function public.add_monthly_tokens_atomic(
  p_user_id uuid,
  p_amount integer
)
returns table (monthly_tokens integer, used_tokens integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  return query
  update public.billing_subscriptions
     set monthly_tokens = monthly_tokens + p_amount
   where user_id = p_user_id
   returning monthly_tokens, used_tokens;
end;
$$;

revoke all on function public.add_monthly_tokens_atomic(uuid, integer) from public;
grant execute on function public.add_monthly_tokens_atomic(uuid, integer) to service_role;
