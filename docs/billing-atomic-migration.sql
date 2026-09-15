-- Apply after billing-schema.sql and stripe-webhook-events-schema.sql.
-- Stop billing writers during migration/deploy. See billing-atomic-rollout.md.
begin;
lock table public.billing_subscriptions in access exclusive mode;

alter table public.billing_subscriptions
  add column if not exists monthly_allowance integer,
  add column if not exists monthly_spent integer,
  add column if not exists purchased_balance integer,
  add column if not exists purchased_spent integer,
  add column if not exists last_token_period_end timestamptz,
  add column if not exists onboarding_bonus_granted boolean not null default false;

-- Preserve the currently visible balance; monthly allowance is spent first.
-- Historical resets cannot be reconstructed from these aggregate fields.
with initial as (
  select user_id, least(monthly_tokens, case plan
    when 'start' then 1200 when 'growth' then 3000 when 'pro' then 7500 else 0 end) as base
  from public.billing_subscriptions where monthly_allowance is null
)
update public.billing_subscriptions b set
  monthly_allowance = i.base,
  monthly_spent = least(b.used_tokens, i.base),
  purchased_balance = greatest(b.monthly_tokens - greatest(b.used_tokens, i.base), 0),
  purchased_spent = greatest(b.used_tokens - i.base, 0),
  last_token_period_end = b.current_period_end,
  onboarding_bonus_granted = b.plan is not null
from initial i where b.user_id = i.user_id;

alter table public.billing_subscriptions
  alter column monthly_allowance set default 0, alter column monthly_allowance set not null,
  alter column monthly_spent set default 0, alter column monthly_spent set not null,
  alter column purchased_balance set default 0, alter column purchased_balance set not null,
  alter column purchased_spent set default 0, alter column purchased_spent set not null;

-- Legacy API/UI fields are projections, never independent writable balances.
create or replace function public.billing_project_balance() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and
    row(new.monthly_allowance, new.monthly_spent, new.purchased_balance, new.purchased_spent)
      is not distinct from row(old.monthly_allowance, old.monthly_spent, old.purchased_balance, old.purchased_spent)
    and row(new.monthly_tokens, new.used_tokens) is distinct from row(old.monthly_tokens, old.used_tokens) then
    raise exception 'Legacy balance writes are disabled; use billing atomic RPCs';
  end if;
  if least(new.monthly_allowance, new.monthly_spent, new.purchased_balance, new.purchased_spent) < 0 then
    raise exception 'Negative token balance';
  end if;
  new.monthly_tokens := greatest(new.monthly_allowance, new.monthly_spent)
    + new.purchased_balance + new.purchased_spent;
  new.used_tokens := new.monthly_spent + new.purchased_spent;
  return new;
end;
$$;
drop trigger if exists billing_project_balance on public.billing_subscriptions;
create trigger billing_project_balance before insert or update on public.billing_subscriptions
for each row execute function public.billing_project_balance();

create or replace function public.billing_adjust_tokens_atomic(p_user_id uuid, p_amount integer, p_operation text)
returns setof public.billing_subscriptions language plpgsql security definer set search_path = public as $$
declare b public.billing_subscriptions; monthly_part integer; extra_part integer;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into b from public.billing_subscriptions where user_id = p_user_id for update;
  if not found then raise exception 'Kein Billing-Profil vorhanden.'; end if;
  if p_operation = 'consume' then
    if b.plan is null or b.subscription_status in ('none', 'canceled') then
      raise exception 'Kein aktives Abo.';
    end if;
    monthly_part := least(p_amount, greatest(b.monthly_allowance - b.monthly_spent, 0));
    extra_part := p_amount - monthly_part;
    if extra_part > b.purchased_balance then raise exception 'Nicht genug Tokens.'; end if;
    update public.billing_subscriptions set monthly_spent = monthly_spent + monthly_part,
      purchased_balance = purchased_balance - extra_part, purchased_spent = purchased_spent + extra_part
      where user_id = p_user_id;
  elsif p_operation = 'refund' then
    extra_part := least(p_amount, b.purchased_spent);
    monthly_part := least(p_amount - extra_part, b.monthly_spent);
    update public.billing_subscriptions set monthly_spent = monthly_spent - monthly_part,
      purchased_balance = purchased_balance + extra_part, purchased_spent = purchased_spent - extra_part
      where user_id = p_user_id;
  elsif p_operation = 'add' then
    update public.billing_subscriptions set purchased_balance = purchased_balance + p_amount where user_id = p_user_id;
  else raise exception 'Unknown token operation'; end if;
  return query select * from public.billing_subscriptions where user_id = p_user_id;
end;
$$;

-- Insertion and credit commit or roll back together, including on timeout/errors.
create or replace function public.billing_grant_token_pack_atomic(
  p_session_id text, p_user_id uuid, p_pack_id text, p_tokens integer, p_source text
) returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_count integer; existing public.billing_token_pack_grants;
begin
  if p_tokens is null or p_tokens <= 0 then raise exception 'Amount must be positive'; end if;
  insert into public.billing_token_pack_grants(session_id, user_id, pack_id, tokens, source)
    values (p_session_id, p_user_id, p_pack_id, p_tokens, p_source)
    on conflict (session_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    select * into existing from public.billing_token_pack_grants where session_id = p_session_id;
    if existing.user_id <> p_user_id or existing.tokens <> p_tokens or existing.pack_id <> p_pack_id then
      raise exception 'Checkout session grant mismatch';
    end if;
    return false;
  end if;
  perform public.billing_adjust_tokens_atomic(p_user_id, p_tokens, 'add');
  return true;
end;
$$;

create or replace function public.billing_activate_plan_atomic(
  p_user_id uuid, p_plan text, p_allowance integer, p_status text,
  p_customer_id text, p_subscription_id text, p_period_end timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare b public.billing_subscriptions;
begin
  insert into public.billing_subscriptions(user_id) values (p_user_id) on conflict do nothing;
  select * into b from public.billing_subscriptions where user_id = p_user_id for update;
  -- Sync changes entitlement, never replenishes spent tokens or replays purchases.
  update public.billing_subscriptions set plan = p_plan, monthly_allowance = p_allowance,
    subscription_status = p_status, stripe_customer_id = p_customer_id,
    stripe_subscription_id = p_subscription_id, current_period_end = p_period_end,
    last_token_period_end = case when b.stripe_subscription_id is distinct from p_subscription_id
      then p_period_end else b.last_token_period_end end
    where user_id = p_user_id;
end;
$$;

create or replace function public.billing_renew_period_atomic(p_subscription_id text, p_period_end timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare b public.billing_subscriptions;
begin
  if p_period_end is null then raise exception 'Billing period missing'; end if;
  select * into b from public.billing_subscriptions where stripe_subscription_id = p_subscription_id for update;
  if not found then raise exception 'Subscription not linked yet'; end if;
  if b.plan is null or b.subscription_status = 'canceled' then return; end if;
  if b.last_token_period_end is not null and p_period_end <= b.last_token_period_end then return; end if;
  update public.billing_subscriptions set monthly_spent = 0, purchased_spent = 0,
    last_token_period_end = p_period_end, current_period_end = p_period_end
    where user_id = b.user_id;
end;
$$;

create or replace function public.billing_cancel_subscription_atomic(p_subscription_id text, p_period_end timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Keep paid extras, but no generation access until another plan is active.
  update public.billing_subscriptions set plan = null, monthly_allowance = 0,
    subscription_status = 'canceled', current_period_end = p_period_end
    where stripe_subscription_id = p_subscription_id;
end;
$$;

create or replace function public.billing_onboarding_bonus_atomic(p_user_id uuid, p_amount integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare b public.billing_subscriptions;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into b from public.billing_subscriptions where user_id = p_user_id for update;
  if not found then raise exception 'Kein Billing-Profil vorhanden.'; end if;
  if b.onboarding_bonus_granted or (b.plan is not null and b.subscription_status not in ('none', 'canceled')) then return false; end if;
  update public.billing_subscriptions set plan = 'start', monthly_allowance = p_amount,
    subscription_status = 'active', onboarding_bonus_granted = true where user_id = p_user_id;
  return true;
end;
$$;

-- Keep the old RPC safe for any remaining server callers; no read/write fallback.
create or replace function public.add_monthly_tokens_atomic(p_user_id uuid, p_amount integer)
returns table(monthly_tokens integer, used_tokens integer)
language sql security definer set search_path = public as $$
  select b.monthly_tokens, b.used_tokens from public.billing_adjust_tokens_atomic(p_user_id, p_amount, 'add') b;
$$;

revoke all on function public.billing_adjust_tokens_atomic(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.billing_grant_token_pack_atomic(text, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.billing_activate_plan_atomic(uuid, text, integer, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.billing_renew_period_atomic(text, timestamptz) from public, anon, authenticated;
revoke all on function public.billing_cancel_subscription_atomic(text, timestamptz) from public, anon, authenticated;
revoke all on function public.billing_onboarding_bonus_atomic(uuid, integer) from public, anon, authenticated;
revoke all on function public.add_monthly_tokens_atomic(uuid, integer) from public, anon, authenticated;
grant execute on function public.billing_adjust_tokens_atomic(uuid, integer, text),
  public.billing_grant_token_pack_atomic(text, uuid, text, integer, text),
  public.billing_activate_plan_atomic(uuid, text, integer, text, text, text, timestamptz),
  public.billing_renew_period_atomic(text, timestamptz),
  public.billing_cancel_subscription_atomic(text, timestamptz),
  public.billing_onboarding_bonus_atomic(uuid, integer),
  public.add_monthly_tokens_atomic(uuid, integer) to service_role;
commit;
