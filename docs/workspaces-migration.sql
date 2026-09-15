begin;
create table if not exists workspace_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','editor','viewer')),
  created_at timestamptz not null default now(),
  check(user_id<>owner_id)
);
create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check(role in ('admin','editor','viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null default now()+interval '7 days',
  created_at timestamptz not null default now(),
  unique(owner_id,email)
);
create index if not exists workspace_members_owner_id_idx on public.workspace_members(owner_id);
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
drop policy if exists "No client access to workspace members" on public.workspace_members;
create policy "No client access to workspace members"
  on public.workspace_members for all to public using (false) with check (false);
drop policy if exists "No client access to workspace invites" on public.workspace_invites;
create policy "No client access to workspace invites"
  on public.workspace_invites for all to public using (false) with check (false);
revoke all on workspace_members,workspace_invites from public,anon,authenticated;
grant all on workspace_members,workspace_invites to service_role;

create or replace function workspace_invite(p_owner uuid,p_email text,p_name text,p_role text,p_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare b billing_subscriptions; seats integer; n integer; result uuid;
begin
  select * into b from billing_subscriptions where user_id=p_owner for update;
  if not found or b.subscription_status not in ('active','trialing') then raise exception 'Aktives Abo erforderlich'; end if;
  seats:=case b.plan when 'pro' then 10 when 'growth' then 3 else 1 end;
  delete from workspace_invites where owner_id=p_owner and expires_at<=now();
  select 1+(select count(*) from workspace_members where owner_id=p_owner)+(select count(*) from workspace_invites where owner_id=p_owner) into n;
  if n>=seats then raise exception 'Alle Teamplätze sind belegt'; end if;
  insert into workspace_invites(owner_id,email,name,role,token_hash) values(p_owner,lower(p_email),p_name,p_role,p_hash) returning id into result;
  return result;
end $$;

create or replace function workspace_accept(p_user uuid,p_hash text,p_email text)
returns uuid language plpgsql security definer set search_path=public as $$
declare invite workspace_invites; b billing_subscriptions; seats integer;
begin
  select * into invite from workspace_invites where token_hash=p_hash;
  if not found then raise exception 'Einladung nicht gefunden'; end if;
  select * into b from billing_subscriptions where user_id=invite.owner_id for update;
  select * into invite from workspace_invites where token_hash=p_hash for update;
  if not found or invite.expires_at<=now() or invite.email<>lower(p_email) or invite.owner_id=p_user then raise exception 'Einladung ungültig'; end if;
  if b.subscription_status not in ('active','trialing') then raise exception 'Teamabo nicht aktiv'; end if;
  if exists(select 1 from workspace_members where user_id=p_user or owner_id=p_user)
    or exists(select 1 from billing_subscriptions where user_id=p_user and stripe_subscription_id is not null and subscription_status not in ('none','canceled')) then
    raise exception 'Konto ist bereits einem Team oder eigenen Abo zugeordnet';
  end if;
  seats:=case b.plan when 'pro' then 10 when 'growth' then 3 else 1 end;
  if (select count(*)+1 from workspace_members where owner_id=invite.owner_id)>=seats then raise exception 'Keine Teamplätze frei'; end if;
  insert into workspace_members(user_id,owner_id,role) values(p_user,invite.owner_id,invite.role);
  delete from workspace_invites where id=invite.id;
  return invite.owner_id;
end $$;
revoke all on function workspace_invite(uuid,text,text,text,text),workspace_accept(uuid,text,text) from public,anon,authenticated;
grant execute on function workspace_invite(uuid,text,text,text,text),workspace_accept(uuid,text,text) to service_role;
commit;
