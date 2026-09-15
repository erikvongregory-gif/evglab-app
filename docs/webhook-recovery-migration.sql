begin;
create or replace function stripe_claim_event(p_id text,p_type text) returns boolean
language plpgsql security definer set search_path=public as $$
declare result text; existing stripe_webhook_events;
begin
  insert into stripe_webhook_events(event_id,event_type,status) values(p_id,p_type,'processing') on conflict do nothing returning event_id into result;
  if result is not null then return true; end if;
  select * into existing from stripe_webhook_events where event_id=p_id for update;
  if existing.status='processed' then return false; end if;
  -- Do not acknowledge an in-flight event; Stripe must retry if its worker dies.
  if existing.created_at>now()-interval '10 minutes' then raise exception 'Webhook is processing; retry later'; end if;
  update stripe_webhook_events set created_at=now() where event_id=p_id;
  return true;
end $$;
revoke all on function stripe_claim_event(text,text) from public,anon,authenticated;
grant execute on function stripe_claim_event(text,text) to service_role;
commit;
