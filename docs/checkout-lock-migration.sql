begin;
create table if not exists billing_checkout_locks (
 user_id uuid primary key references auth.users(id) on delete cascade,
 id uuid not null default gen_random_uuid(), plan text not null, interval text not null,
 expires_at timestamptz not null default now()+interval '24 hours'
);
alter table billing_checkout_locks enable row level security;
revoke all on billing_checkout_locks from public,anon,authenticated;
grant all on billing_checkout_locks to service_role;
create or replace function billing_claim_checkout(p_user uuid,p_plan text,p_interval text) returns uuid
language plpgsql security definer set search_path=public as $$
declare c billing_checkout_locks;
begin
 perform 1 from billing_subscriptions where user_id=p_user for update;
 if not found then raise exception 'Billing profile missing'; end if;
 delete from billing_checkout_locks where user_id=p_user and expires_at<=now();
 insert into billing_checkout_locks(user_id,plan,interval) values(p_user,p_plan,p_interval) on conflict do nothing;
 select * into c from billing_checkout_locks where user_id=p_user;
 if c.plan<>p_plan or c.interval<>p_interval then raise exception 'Ein anderer Checkout ist noch offen. Bitte zuerst abschließen oder nach Ablauf erneut versuchen.'; end if;
 return c.id;
end $$;
revoke all on function billing_claim_checkout(uuid,text,text) from public,anon,authenticated;
grant execute on function billing_claim_checkout(uuid,text,text) to service_role;
commit;
