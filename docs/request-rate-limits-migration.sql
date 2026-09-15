begin;
create table if not exists public.request_rate_limits (
  rate_key text primary key,
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null
);
create index if not exists request_rate_limits_reset_at_idx
  on public.request_rate_limits(reset_at);
alter table public.request_rate_limits enable row level security;
drop policy if exists "No client access to request rate limits" on public.request_rate_limits;
create policy "No client access to request rate limits"
  on public.request_rate_limits for all to public using (false) with check (false);
revoke all on public.request_rate_limits from public, anon, authenticated;
grant all on public.request_rate_limits to service_role;

create or replace function public.enforce_rate_limit_atomic(
  p_key text,
  p_limit integer,
  p_window_ms integer
) returns table(allowed boolean, retry_after integer)
language plpgsql security definer set search_path = public as $$
declare
  current_row public.request_rate_limits;
  current_time timestamptz := clock_timestamp();
begin
  if p_key is null or length(p_key) < 10 or length(p_key) > 200
    or p_limit < 1 or p_window_ms < 1000 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.request_rate_limits(rate_key, request_count, reset_at)
  values(p_key, 1, current_time + make_interval(secs => p_window_ms / 1000.0))
  on conflict(rate_key) do update set
    request_count = case
      when request_rate_limits.reset_at <= current_time then 1
      else request_rate_limits.request_count + 1
    end,
    reset_at = case
      when request_rate_limits.reset_at <= current_time
        then current_time + make_interval(secs => p_window_ms / 1000.0)
      else request_rate_limits.reset_at
    end
  returning * into current_row;

  return query select
    current_row.request_count <= p_limit,
    greatest(1, ceil(extract(epoch from (current_row.reset_at - current_time)))::integer);
end;
$$;

revoke all on function public.enforce_rate_limit_atomic(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.enforce_rate_limit_atomic(text, integer, integer)
  to service_role;
commit;
