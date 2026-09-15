begin;
create table if not exists account_deletion_jobs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_error text
);
alter table account_deletion_jobs enable row level security;
drop policy if exists "No client access to account deletion jobs" on public.account_deletion_jobs;
create policy "No client access to account deletion jobs"
  on public.account_deletion_jobs for all to public using (false) with check (false);
revoke all on account_deletion_jobs from public,anon,authenticated;
grant all on account_deletion_jobs to service_role;
commit;
