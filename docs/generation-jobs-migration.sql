-- Requires billing-atomic-migration.sql. No automatic refund of ambiguous provider timeouts.
begin;
create table if not exists public.generation_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  request_hash text not null,
  amount integer not null check(amount >= 0),
  monthly_part integer not null,
  purchased_part integer not null,
  token_period timestamptz,
  provider_task_id text unique,
  status text not null default 'reserved' check(status in ('reserved','completed','failed','needs_review')),
  charged integer,
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(user_id, request_key)
);
alter table public.generation_jobs enable row level security;
drop policy if exists "No client access to generation jobs" on public.generation_jobs;
create policy "No client access to generation jobs"
  on public.generation_jobs for all to public using (false) with check (false);
revoke all on public.generation_jobs from public, anon, authenticated;
grant all on public.generation_jobs to service_role;

create or replace function public.generation_reserve(p_id uuid, p_user_id uuid, p_key text, p_hash text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.billing_subscriptions; j public.generation_jobs; m integer;
begin
  if p_amount < 0 or length(p_key) > 160 then raise exception 'Invalid reservation'; end if;
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  if not found then raise exception 'Billing profile missing'; end if;
  select * into j from generation_jobs where user_id=p_user_id and request_key=p_key;
  if found then
    if j.request_hash <> p_hash or j.amount <> p_amount then raise exception 'Idempotency key mismatch'; end if;
    return jsonb_build_object('fresh',false,'job',to_jsonb(j));
  end if;
  m := least(p_amount, greatest(b.monthly_allowance-b.monthly_spent,0));
  if p_amount > 0 then perform billing_adjust_tokens_atomic(p_user_id,p_amount,'consume'); end if;
  insert into generation_jobs(id,user_id,request_key,request_hash,amount,monthly_part,purchased_part,token_period)
    values(p_id,p_user_id,p_key,p_hash,p_amount,m,p_amount-m,b.last_token_period_end) returning * into j;
  return jsonb_build_object('fresh',true,'job',to_jsonb(j));
end $$;

create or replace function public.generation_finish(p_id uuid,p_user_id uuid,p_charged integer,p_result jsonb)
returns setof public.billing_subscriptions language plpgsql security definer set search_path = public as $$
declare j public.generation_jobs; b public.billing_subscriptions; refund integer; extra integer; monthly integer;
begin
  select * into b from billing_subscriptions where user_id=p_user_id for update;
  select * into j from generation_jobs where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'Job not found'; end if;
  if j.status in ('completed','failed') then return query select * from billing_subscriptions where user_id=p_user_id; return; end if;
  if p_charged < 0 or p_charged > j.amount then raise exception 'Invalid settlement'; end if;
  refund := j.amount-p_charged;
  extra := least(refund,j.purchased_part);
  monthly := refund-extra;
  update billing_subscriptions set
    purchased_balance=purchased_balance+extra,
    purchased_spent=greatest(0,purchased_spent-extra),
    monthly_spent=case when last_token_period_end is not distinct from j.token_period
      then greatest(0,monthly_spent-monthly) else monthly_spent end
    where user_id=p_user_id;
  update generation_jobs set status=case when p_charged=0 then 'failed' else 'completed' end,
    charged=p_charged,result=p_result,finished_at=now() where id=p_id;
  return query select * from billing_subscriptions where user_id=p_user_id;
end $$;
revoke all on function public.generation_reserve(uuid,uuid,text,text,integer), public.generation_finish(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.generation_reserve(uuid,uuid,text,text,integer), public.generation_finish(uuid,uuid,integer,jsonb) to service_role;
commit;
