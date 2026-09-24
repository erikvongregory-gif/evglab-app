-- Abo-Tokens: einheitlich 1 Monat Übertrag (30 Tage ab Periodenbeginn), alle Pläne.
create or replace function billing_refresh_monthly(p_user_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; expiry timestamptz; next_at timestamptz;
begin
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if not found then return; end if;
  while b.token_next_at is not null and b.token_next_at<=now()
    and b.token_next_at<b.current_period_end and b.subscription_status in ('active','trialing') and b.plan is not null loop
    next_at:=b.token_anchor+make_interval(months=>b.token_period_index+2);
    expiry:=next_at+interval '30 days';
    insert into token_lots(user_id,source,remaining,expires_at,grant_key)
      values(p_user_id,'monthly',b.monthly_allowance,expiry,'period:'||b.stripe_subscription_id||':'||b.token_next_at::text)
      on conflict(user_id,grant_key) do nothing;
    b.token_period_index:=b.token_period_index+1;
    update billing_subscriptions set token_period_index=b.token_period_index, token_next_at=next_at,
      last_token_period_end=next_at,monthly_spent=0,purchased_spent=0,token_period_granted=monthly_allowance where user_id=p_user_id;
    b.token_next_at:=next_at;
  end loop;
  update billing_subscriptions set monthly_spent=monthly_spent where user_id=p_user_id;
end $$;

create or replace function billing_set_token_schedule(p_user_id uuid,p_subscription_id text,p_start timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; idx integer:=0; boundary timestamptz;
begin
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if b.stripe_subscription_id is distinct from p_subscription_id or p_start is null then raise exception 'Invalid subscription schedule'; end if;
  if b.token_anchor is null then
    boundary:=p_start+interval '1 month';
    while boundary<=now() and boundary<b.current_period_end loop
      idx:=idx+1; boundary:=p_start+make_interval(months=>idx+1);
    end loop;
    update billing_subscriptions set token_anchor=p_start,token_next_at=boundary,token_period_index=idx,last_token_period_end=boundary
      where user_id=p_user_id;
    update token_lots set expires_at=boundary+interval '30 days'
      where user_id=p_user_id and grant_key in ('migration-monthly','initial:'||p_subscription_id);
  end if;
  perform billing_refresh_monthly(p_user_id);
end $$;

create or replace function billing_activate_plan_atomic(p_user_id uuid,p_plan text,p_allowance integer,p_status text,p_customer_id text,p_subscription_id text,p_period_end timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; expiry timestamptz; delta integer;
begin
  insert into billing_subscriptions(user_id) values(p_user_id) on conflict do nothing;
  perform billing_refresh_monthly(p_user_id);
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if b.stripe_subscription_id is not null and b.stripe_subscription_id<>p_subscription_id and b.subscription_status not in ('canceled','none') then
    raise exception 'A different subscription is already linked';
  end if;
  expiry:=coalesce(b.token_next_at,now()+interval '1 month')+interval '30 days';
  delta:=case when b.stripe_subscription_id is distinct from p_subscription_id and b.subscription_status='canceled'
    then p_allowance else greatest(p_allowance-b.token_period_granted,0) end;
  if delta>0 then insert into token_lots(user_id,source,remaining,expires_at,grant_key)
    values(p_user_id,'monthly',delta,expiry,case when b.stripe_subscription_id is distinct from p_subscription_id then 'initial:'||p_subscription_id else null end)
    on conflict(user_id,grant_key) do update set remaining=token_lots.remaining+excluded.remaining,expires_at=excluded.expires_at;
  end if;
  update billing_subscriptions set plan=p_plan,monthly_allowance=p_allowance,subscription_status=p_status,
    stripe_customer_id=p_customer_id,stripe_subscription_id=p_subscription_id,current_period_end=p_period_end,
    token_anchor=case when b.stripe_subscription_id is distinct from p_subscription_id then null else token_anchor end,
    token_next_at=case when b.stripe_subscription_id is distinct from p_subscription_id then null else token_next_at end,
    token_period_granted=greatest(token_period_granted,p_allowance)
    where user_id=p_user_id;
end $$;
