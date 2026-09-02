-- ZeroPulse accounts, Stripe entitlements, atomic daily usage, and VIP licenses.
-- Apply with `supabase db push` or through the Lovable/Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.plan_tier as enum ('starter', 'builder_pro', 'architect');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.license_key_status as enum ('available', 'claimed', 'revoked');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  plan_tier public.plan_tier not null default 'starter',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  unlimited_tester boolean not null default false,
  daily_usage_counter jsonb not null default '{"date": null, "tasks": 0, "blocks": 0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  task_count integer not null default 0 check (task_count >= 0),
  block_count bigint not null default 0 check (block_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash char(64) not null unique,
  key_hint text not null,
  hwid_hash char(64),
  status public.license_key_status not null default 'available',
  claimed_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  constraint claimed_license_is_bound check (
    (status = 'available' and claimed_by_user_id is null and hwid_hash is null and activated_at is null)
    or (status = 'claimed' and claimed_by_user_id is not null and hwid_hash is not null and activated_at is not null)
    or status = 'revoked'
  )
);

create index if not exists license_keys_claimed_by_idx on public.license_keys(claimed_by_user_id);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Private, server-managed allowlist used to promote trusted owner accounts at signup.
-- RLS and explicit grants below keep this invisible to browser clients.
create table if not exists public.admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (
    new.id,
    new.email,
    exists (
      select 1 from public.admin_allowlist
      where email = lower(coalesce(new.email, ''))
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      is_admin = public.profiles.is_admin or excluded.is_admin,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, is_admin)
select
  users.id,
  users.email,
  exists (
    select 1 from public.admin_allowlist
    where admin_allowlist.email = lower(coalesce(users.email, ''))
  )
from auth.users as users
on conflict (id) do update
set email = excluded.email,
    is_admin = public.profiles.is_admin or excluded.is_admin,
    updated_at = now();

create or replace function public.verify_and_consume_builder_run(p_user_id uuid, p_requested_blocks integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_profile public.profiles%rowtype;
  v_usage public.daily_usage%rowtype;
  v_task_limit integer;
  v_block_limit bigint;
  v_today date := (timezone('utc', now()))::date;
begin
  if p_requested_blocks is null or p_requested_blocks < 1 or p_requested_blocks > 1000000 then
    return jsonb_build_object('allowed', false, 'code', 'invalid_block_count', 'message', 'Invalid requested block count.');
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'code', 'profile_missing', 'message', 'Account profile is not ready.');
  end if;

  if v_profile.unlimited_tester then
    return jsonb_build_object('allowed', true, 'planTier', 'unlimited_tester', 'tasksRemaining', null, 'blocksRemaining', null, 'bypass', true);
  end if;

  if v_profile.subscription_status not in ('active', 'trialing') then
    return jsonb_build_object('allowed', false, 'code', 'subscription_required', 'message', 'An active ZeroPulse subscription is required.', 'planTier', v_profile.plan_tier);
  end if;

  case v_profile.plan_tier
    when 'starter' then v_task_limit := 5; v_block_limit := 5000;
    when 'builder_pro' then v_task_limit := 30; v_block_limit := 50000;
    when 'architect' then v_task_limit := null; v_block_limit := 500000;
  end case;

  insert into public.daily_usage (user_id, usage_date) values (p_user_id, v_today)
  on conflict (user_id, usage_date) do nothing;
  select * into v_usage from public.daily_usage
  where user_id = p_user_id and usage_date = v_today for update;

  if v_task_limit is not null and v_usage.task_count + 1 > v_task_limit then
    return jsonb_build_object('allowed', false, 'code', 'daily_task_limit', 'message', 'Daily task limit reached.', 'tasksRemaining', 0, 'blocksRemaining', greatest(0, v_block_limit - v_usage.block_count));
  end if;

  if v_usage.block_count + p_requested_blocks > v_block_limit then
    return jsonb_build_object('allowed', false, 'code', 'daily_block_limit', 'message', 'This build exceeds your remaining daily block allowance.', 'tasksRemaining', case when v_task_limit is null then null else greatest(0, v_task_limit - v_usage.task_count) end, 'blocksRemaining', greatest(0, v_block_limit - v_usage.block_count));
  end if;

  update public.daily_usage set task_count = task_count + 1,
    block_count = block_count + p_requested_blocks, updated_at = now()
  where user_id = p_user_id and usage_date = v_today returning * into v_usage;

  update public.profiles set daily_usage_counter = jsonb_build_object('date', v_today, 'tasks', v_usage.task_count, 'blocks', v_usage.block_count), updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('allowed', true, 'planTier', v_profile.plan_tier, 'tasksRemaining', case when v_task_limit is null then null else greatest(0, v_task_limit - v_usage.task_count) end, 'blocksRemaining', greatest(0, v_block_limit - v_usage.block_count), 'bypass', false);
end;
$$;

create or replace function public.redeem_license_key(p_user_id uuid, p_key_hash text, p_hwid_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_key public.license_keys%rowtype;
begin
  select * into v_key from public.license_keys where key_hash = p_key_hash for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid_key', 'message', 'That ZeroPulse key is invalid.'); end if;
  if v_key.status = 'revoked' then return jsonb_build_object('ok', false, 'code', 'revoked_key', 'message', 'That key has been revoked.'); end if;
  if v_key.status = 'claimed' then
    if v_key.claimed_by_user_id <> p_user_id then return jsonb_build_object('ok', false, 'code', 'already_claimed', 'message', 'That key has already been claimed.'); end if;
    if v_key.hwid_hash <> p_hwid_hash then return jsonb_build_object('ok', false, 'code', 'hardware_mismatch', 'message', 'That key is locked to a different device.'); end if;
    return jsonb_build_object('ok', true, 'code', 'already_active', 'message', 'Unlimited tester access is already active.');
  end if;

  update public.license_keys set status = 'claimed', claimed_by_user_id = p_user_id,
    hwid_hash = p_hwid_hash, activated_at = now() where id = v_key.id;
  update public.profiles set unlimited_tester = true, updated_at = now() where id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'activated', 'message', 'Lifetime unlimited tester access activated.');
end;
$$;

create or replace function public.revoke_license_key(p_key_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_claimed_by uuid;
begin
  select claimed_by_user_id into v_claimed_by
  from public.license_keys where id = p_key_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'key_not_found', 'message', 'License key was not found.');
  end if;

  update public.license_keys
  set status = 'revoked', revoked_at = coalesce(revoked_at, now())
  where id = p_key_id;

  if v_claimed_by is not null then
    update public.profiles
    set unlimited_tester = exists (
      select 1 from public.license_keys
      where claimed_by_user_id = v_claimed_by
        and status = 'claimed'
        and id <> p_key_id
    ), updated_at = now()
    where id = v_claimed_by;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

alter table public.profiles enable row level security;
alter table public.daily_usage enable row level security;
alter table public.license_keys enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.admin_allowlist enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "daily_usage_select_own" on public.daily_usage;
create policy "daily_usage_select_own" on public.daily_usage for select to authenticated using (auth.uid() = user_id);

-- No client write policies are intentional. Trusted service-role API routes own all mutations.
revoke all on function public.verify_and_consume_builder_run(uuid, integer) from public, anon, authenticated;
revoke all on function public.redeem_license_key(uuid, text, text) from public, anon, authenticated;
revoke all on function public.revoke_license_key(uuid) from public, anon, authenticated;
grant execute on function public.verify_and_consume_builder_run(uuid, integer) to service_role;
grant execute on function public.redeem_license_key(uuid, text, text) to service_role;
grant execute on function public.revoke_license_key(uuid) to service_role;

revoke all on table public.admin_allowlist from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_allowlist to service_role;
