-- Apply AFTER generation-jobs-migration.sql. All mutations lock the billing row first.
begin;
alter table billing_subscriptions add column if not exists token_anchor timestamptz,
  add column if not exists token_period_index integer not null default 0,
  add column if not exists token_next_at timestamptz,
  add column if not exists token_period_granted integer not null default 0;
update billing_subscriptions set token_period_granted=monthly_allowance where token_period_granted=0;
create table if not exists public.token_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  remaining integer not null check(remaining>=0),
  expires_at timestamptz,
  grant_key text,
  unique(user_id,grant_key)
);
alter table token_lots enable row level security;
revoke all on token_lots from public,anon,authenticated;
grant all on token_lots to service_role;
alter table generation_jobs add column if not exists allocations jsonb not null default '[]';

-- Preserve visible balances on the first application; do not reconstruct historical credits.
insert into token_lots(user_id,source,remaining,expires_at,grant_key)
select user_id,'monthly',greatest(monthly_allowance-monthly_spent,0),
  coalesce(current_period_end,now()+interval '1 month') +
    (case plan when 'pro' then 90 when 'growth' then 60 else 30 end)*interval '1 day','migration-monthly'
from billing_subscriptions on conflict(user_id,grant_key) do nothing;
insert into token_lots(user_id,source,remaining,grant_key)
select user_id,'purchased',purchased_balance,'migration-purchased' from billing_subscriptions
on conflict(user_id,grant_key) do nothing;

create or replace function billing_project_balance() returns trigger language plpgsql set search_path=public as $$
declare available integer; extras integer;
begin
  select coalesce(sum(remaining),0),coalesce(sum(remaining) filter(where source='purchased'),0)
    into available,extras from token_lots where user_id=new.user_id and (expires_at is null or expires_at>now());
  new.purchased_balance:=extras;
  new.used_tokens:=new.monthly_spent+new.purchased_spent;
  new.monthly_tokens:=available+new.used_tokens;
  return new;
end $$;

create or replace function billing_refresh_monthly(p_user_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; expiry timestamptz; carry integer; next_at timestamptz;
begin
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if not found then return; end if;
  carry:=case b.plan when 'pro' then 90 when 'growth' then 60 else 30 end;
  while b.token_next_at is not null and b.token_next_at<=now()
    and b.token_next_at<b.current_period_end and b.subscription_status in ('active','trialing') and b.plan is not null loop
    next_at:=b.token_anchor+make_interval(months=>b.token_period_index+2);
    expiry:=next_at+make_interval(days=>carry);
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
    -- Bootstrap existing subscriptions without inventing historical allowances/plan changes.
    boundary:=p_start+interval '1 month';
    while boundary<=now() and boundary<b.current_period_end loop
      idx:=idx+1; boundary:=p_start+make_interval(months=>idx+1);
    end loop;
    update billing_subscriptions set token_anchor=p_start,token_next_at=boundary,token_period_index=idx,last_token_period_end=boundary
      where user_id=p_user_id;
    -- Migrated current tokens expire relative to the first budget period, not the yearly invoice.
    update token_lots set expires_at=boundary+
      make_interval(days=>case b.plan when 'pro' then 90 when 'growth' then 60 else 30 end)
      where user_id=p_user_id and grant_key in ('migration-monthly','initial:'||p_subscription_id);
  end if;
  perform billing_refresh_monthly(p_user_id);
end $$;

create or replace function billing_debit_lots(p_user_id uuid,p_amount integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; lot token_lots; left_to_debit integer:=p_amount; take integer; allocations jsonb:='[]'; m integer:=0; p integer:=0;
begin
  perform billing_refresh_monthly(p_user_id);
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if p_amount<0 or b.plan is null or b.subscription_status not in ('active','trialing') then raise exception 'Kein aktives Abo.'; end if;
  if b.token_next_at is not null and b.current_period_end<=now() then raise exception 'Aboperiode nicht bestätigt.'; end if;
  for lot in select * from token_lots where user_id=p_user_id and remaining>0 and (expires_at is null or expires_at>now())
    order by expires_at nulls last,id for update loop
    take:=least(left_to_debit,lot.remaining);
    if take>0 then
      update token_lots set remaining=remaining-take where id=lot.id;
      allocations:=allocations||jsonb_build_array(jsonb_build_object('id',lot.id,'amount',take,'source',lot.source));
      if lot.source='purchased' then p:=p+take; else m:=m+take; end if;
      left_to_debit:=left_to_debit-take;
    end if;
    exit when left_to_debit=0;
  end loop;
  if left_to_debit>0 then raise exception 'Nicht genug Tokens.'; end if;
  update billing_subscriptions set monthly_spent=monthly_spent+m,purchased_spent=purchased_spent+p where user_id=p_user_id;
  return allocations;
end $$;

create or replace function billing_adjust_tokens_atomic(p_user_id uuid,p_amount integer,p_operation text)
returns setof billing_subscriptions language plpgsql security definer set search_path=public as $$
begin
  if p_amount is null or p_amount<=0 then raise exception 'Invalid amount'; end if;
  perform 1 from billing_subscriptions where user_id=p_user_id for update;
  if not found then raise exception 'Billing profile missing'; end if;
  if p_operation='consume' then perform billing_debit_lots(p_user_id,p_amount);
  elsif p_operation='add' then
    insert into token_lots(user_id,source,remaining) values(p_user_id,'purchased',p_amount);
    update billing_subscriptions set purchased_balance=purchased_balance where user_id=p_user_id;
  else raise exception 'Refund requires a generation job'; end if;
  return query select * from billing_subscriptions where user_id=p_user_id;
end $$;

create or replace function billing_activate_plan_atomic(p_user_id uuid,p_plan text,p_allowance integer,p_status text,p_customer_id text,p_subscription_id text,p_period_end timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; expiry timestamptz; delta integer;
begin
  insert into billing_subscriptions(user_id) values(p_user_id) on conflict do nothing;
  -- Close elapsed periods using the previous entitlement before applying a plan change.
  perform billing_refresh_monthly(p_user_id);
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if b.stripe_subscription_id is not null and b.stripe_subscription_id<>p_subscription_id and b.subscription_status not in ('canceled','none') then
    raise exception 'A different subscription is already linked';
  end if;
  expiry:=coalesce(b.token_next_at,now()+interval '1 month')+make_interval(days=>case p_plan when 'pro' then 90 when 'growth' then 60 else 30 end);
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

create or replace function billing_renew_period_atomic(p_subscription_id text,p_period_end timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
  if p_period_end is null then raise exception 'Missing period'; end if;
  update billing_subscriptions set current_period_end=greatest(current_period_end,p_period_end)
    where stripe_subscription_id=p_subscription_id returning user_id into uid;
  if uid is null then raise exception 'Subscription not linked'; end if;
  perform billing_refresh_monthly(uid);
end $$;

create or replace function billing_onboarding_bonus_atomic(p_user_id uuid,p_amount integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions;
begin
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if not found or p_amount<=0 then raise exception 'Invalid bonus'; end if;
  if b.onboarding_bonus_granted or b.stripe_subscription_id is not null then return false; end if;
  insert into token_lots(user_id,source,remaining,expires_at,grant_key) values(p_user_id,'monthly',p_amount,now()+interval '30 days','bonus');
  update billing_subscriptions set plan='start',monthly_allowance=p_amount,token_period_granted=p_amount,subscription_status='active',onboarding_bonus_granted=true where user_id=p_user_id;
  return true;
end $$;

create or replace function generation_reserve(p_id uuid,p_user_id uuid,p_key text,p_hash text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j generation_jobs; a jsonb:='[]';
begin
  if p_amount<0 or length(p_key)>160 then raise exception 'Invalid reservation'; end if;
  perform 1 from billing_subscriptions where user_id=p_user_id for update;
  if not found then raise exception 'Billing profile missing'; end if;
  select * into j from generation_jobs where user_id=p_user_id and request_key=p_key;
  if found then
    if j.request_hash<>p_hash or j.amount<>p_amount then raise exception 'Idempotency key mismatch'; end if;
    return jsonb_build_object('fresh',false,'job',to_jsonb(j));
  end if;
  if p_amount>0 then a:=billing_debit_lots(p_user_id,p_amount); end if;
  insert into generation_jobs(id,user_id,request_key,request_hash,amount,monthly_part,purchased_part,allocations,token_period)
    values(p_id,p_user_id,p_key,p_hash,p_amount,0,0,a,(select last_token_period_end from billing_subscriptions where user_id=p_user_id)) returning * into j;
  return jsonb_build_object('fresh',true,'job',to_jsonb(j));
end $$;

create or replace function generation_finish(p_id uuid,p_user_id uuid,p_charged integer,p_result jsonb)
returns setof billing_subscriptions language plpgsql security definer set search_path=public as $$
declare j generation_jobs; a jsonb; remaining_charge integer:=p_charged; spent integer; refund integer; m integer:=0; p integer:=0;
begin
  perform 1 from billing_subscriptions where user_id=p_user_id for update;
  select * into j from generation_jobs where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'Job not found'; end if;
  if j.status in ('completed','failed') then return query select * from billing_subscriptions where user_id=p_user_id; return; end if;
  if p_charged<0 or p_charged>j.amount then raise exception 'Invalid settlement'; end if;
  for a in select * from jsonb_array_elements(j.allocations) loop
    spent:=least(remaining_charge,(a->>'amount')::integer);
    refund:=(a->>'amount')::integer-spent;
    remaining_charge:=remaining_charge-spent;
    -- Restore the original lot, including its original expiry. Never credit a new period.
    update token_lots set remaining=remaining+refund where id=(a->>'id')::uuid and user_id=p_user_id;
    if a->>'source'='purchased' then p:=p+refund; else m:=m+refund; end if;
  end loop;
  update billing_subscriptions set
    monthly_spent=case when last_token_period_end is not distinct from j.token_period then greatest(0,monthly_spent-m) else monthly_spent end,
    purchased_spent=case when last_token_period_end is not distinct from j.token_period then greatest(0,purchased_spent-p) else purchased_spent end
    where user_id=p_user_id;
  update generation_jobs set status=case when p_charged=0 and (p_result ? 'error' or coalesce(p_result->>'state','') in ('failed','error','canceled','cancelled')) then 'failed' else 'completed' end,
    charged=p_charged,result=p_result,finished_at=now() where id=p_id;
  return query select * from billing_subscriptions where user_id=p_user_id;
end $$;
revoke all on function billing_refresh_monthly(uuid),billing_set_token_schedule(uuid,text,timestamptz),billing_debit_lots(uuid,integer) from public,anon,authenticated;
grant execute on function billing_refresh_monthly(uuid),billing_set_token_schedule(uuid,text,timestamptz),billing_debit_lots(uuid,integer) to service_role;
update billing_subscriptions set monthly_spent=monthly_spent;
commit;
