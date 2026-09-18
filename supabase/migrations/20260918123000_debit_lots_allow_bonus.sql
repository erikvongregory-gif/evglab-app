-- Willkommensbonus hat plan=null / status=none, aber spendbare token_lots.
-- billing_debit_lots darf dann nicht mehr „Kein aktives Abo“ werfen.

create or replace function public.billing_debit_lots(p_user_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b billing_subscriptions;
  lot token_lots;
  left_to_debit integer := p_amount;
  take integer;
  allocations jsonb := '[]';
  m integer := 0;
  p integer := 0;
begin
  perform billing_refresh_monthly(p_user_id);
  select * into b from billing_subscriptions where user_id = p_user_id for update;
  if not found then
    raise exception 'Billing profile missing';
  end if;
  if p_amount < 0 then
    raise exception 'Invalid amount';
  end if;

  -- Stripe-Abo: Status + Periode. Bonus-only (kein Stripe): Lots entscheiden.
  if b.stripe_subscription_id is not null then
    if b.subscription_status not in ('active', 'trialing') then
      raise exception 'Kein aktives Abo.';
    end if;
    if b.token_next_at is not null and b.current_period_end <= now() then
      raise exception 'Aboperiode nicht bestätigt.';
    end if;
  end if;

  for lot in
    select *
    from token_lots
    where user_id = p_user_id
      and remaining > 0
      and (expires_at is null or expires_at > now())
    order by expires_at nulls last, id
    for update
  loop
    take := least(left_to_debit, lot.remaining);
    if take > 0 then
      update token_lots set remaining = remaining - take where id = lot.id;
      allocations := allocations || jsonb_build_array(
        jsonb_build_object('id', lot.id, 'amount', take, 'source', lot.source)
      );
      if lot.source = 'purchased' then
        p := p + take;
      else
        m := m + take;
      end if;
      left_to_debit := left_to_debit - take;
    end if;
    exit when left_to_debit = 0;
  end loop;

  if left_to_debit > 0 then
    raise exception 'Nicht genug Tokens.';
  end if;

  update billing_subscriptions
  set
    monthly_spent = monthly_spent + m,
    purchased_spent = purchased_spent + p
  where user_id = p_user_id;

  return allocations;
end;
$$;

revoke all on function public.billing_debit_lots(uuid, integer) from public, anon, authenticated;
grant execute on function public.billing_debit_lots(uuid, integer) to service_role;
