-- Willkommensbonus: Tokens ohne Fake-Start-Abo.
-- plan/status nur über Stripe (billing_activate_plan_atomic).

create or replace function public.billing_onboarding_bonus_atomic(p_user_id uuid, p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.billing_subscriptions;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into b from public.billing_subscriptions where user_id = p_user_id for update;
  if not found then
    raise exception 'Kein Billing-Profil vorhanden.';
  end if;

  if b.onboarding_bonus_granted or b.stripe_subscription_id is not null then
    return false;
  end if;

  insert into public.token_lots(user_id, source, remaining, expires_at, grant_key)
  values (p_user_id, 'monthly', p_amount, now() + interval '30 days', 'bonus:' || p_user_id::text);

  update public.billing_subscriptions
  set
    monthly_allowance = greatest(coalesce(monthly_allowance, 0), p_amount),
    token_period_granted = p_amount,
    onboarding_bonus_granted = true
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.billing_onboarding_bonus_atomic(uuid, integer) from public, anon, authenticated;
grant execute on function public.billing_onboarding_bonus_atomic(uuid, integer) to service_role;

-- Bestehende Bonus-only Zeilen: Fake-Start entfernen (Lots/Guthaben bleiben)
update public.billing_subscriptions
set
  plan = null,
  subscription_status = 'none'
where stripe_subscription_id is null
  and coalesce(onboarding_bonus_granted, false) = true
  and plan is not null
  and subscription_status in ('active', 'trialing');
