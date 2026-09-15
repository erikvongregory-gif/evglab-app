begin;
create table if not exists account_deletion_jobs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_error text
);
alter table account_deletion_jobs enable row level security;
revoke all on account_deletion_jobs from public,anon,authenticated;
grant all on account_deletion_jobs to service_role;
commit;
