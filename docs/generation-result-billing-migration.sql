-- Apply after billing-periods-migration.sql.
-- Stores the settled balance in generation_jobs.result in the same transaction.
begin;
create or replace function public.generation_finish(p_id uuid,p_user_id uuid,p_charged integer,p_result jsonb)
returns setof public.billing_subscriptions language plpgsql security definer set search_path=public as $$
declare j generation_jobs; b billing_subscriptions; a jsonb; final_result jsonb:=p_result; remaining_charge integer:=p_charged; spent integer; refund integer; m integer:=0; p integer:=0;
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
    update token_lots set remaining=remaining+refund where id=(a->>'id')::uuid and user_id=p_user_id;
    if a->>'source'='purchased' then p:=p+refund; else m:=m+refund; end if;
  end loop;
  update billing_subscriptions set
    monthly_spent=case when last_token_period_end is not distinct from j.token_period then greatest(0,monthly_spent-m) else monthly_spent end,
    purchased_spent=case when last_token_period_end is not distinct from j.token_period then greatest(0,purchased_spent-p) else purchased_spent end
    where user_id=p_user_id;
  select * into b from billing_subscriptions where user_id=p_user_id;
  if p_charged>0 and p_result ? 'billing' then
    final_result:=jsonb_set(p_result,'{billing}',coalesce(p_result->'billing','{}'::jsonb)||jsonb_build_object(
      'plan',b.plan,'monthlyTokens',b.monthly_tokens,'usedTokens',b.used_tokens,
      'remainingTokens',greatest(b.monthly_tokens-b.used_tokens,0),'consumed',p_charged
    ),true);
  end if;
  update generation_jobs set status=case when p_charged=0 and (p_result ? 'error' or coalesce(p_result->>'state','') in ('failed','error','canceled','cancelled')) then 'failed' else 'completed' end,
    charged=p_charged,result=final_result,finished_at=now() where id=p_id;
  return query select * from billing_subscriptions where user_id=p_user_id;
end $$;
revoke all on function public.generation_finish(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.generation_finish(uuid,uuid,integer,jsonb) to service_role;
commit;
