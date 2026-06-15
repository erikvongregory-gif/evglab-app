-- EvGlab Billing & Launch Schema
-- Run in Supabase SQL Editor BEFORE stripe-webhook-events-schema.sql

-- ============================================================================
-- billing_subscriptions: Stripe-Abo + Token-Guthaben pro Nutzer
-- Zugriff nur über service_role (Server/API). Kein Client-Zugriff.
-- ============================================================================
create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text null check (plan is null or plan in ('start', 'growth', 'pro')),
  monthly_tokens integer not null default 0 check (monthly_tokens >= 0),
  used_tokens integer not null default 0 check (used_tokens >= 0),
  stripe_customer_id text null,
  stripe_subscription_id text null,
  subscription_status text not null default 'none'
    check (subscription_status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid', 'none')),
  current_period_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_subscriptions_stripe_customer_uidx
  on public.billing_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists billing_subscriptions_stripe_subscription_uidx
  on public.billing_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (subscription_status, updated_at desc);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "No client access to billing_subscriptions" on public.billing_subscriptions;
create policy "No client access to billing_subscriptions"
on public.billing_subscriptions
for all
to authenticated
using (false)
with check (false);

-- ============================================================================
-- invites: Admin-Einladungen (Invite-only Registrierung)
-- ============================================================================
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text null check (role is null or role in ('viewer', 'editor', 'admin')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  consumed_by_email text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites (email);
create index if not exists invites_expires_idx on public.invites (expires_at desc);

alter table public.invites enable row level security;

drop policy if exists "No client access to invites" on public.invites;
create policy "No client access to invites"
on public.invites
for all
to authenticated
using (false)
with check (false);

-- ============================================================================
-- waitlist_signups: Warteliste auf /anmelden
-- ============================================================================
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'login_waitlist',
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_uidx on public.waitlist_signups (email);

alter table public.waitlist_signups enable row level security;

drop policy if exists "No client access to waitlist_signups" on public.waitlist_signups;
create policy "No client access to waitlist_signups"
on public.waitlist_signups
for all
to authenticated
using (false)
with check (false);
