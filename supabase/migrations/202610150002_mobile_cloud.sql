-- Optional Supabase mirror for VoiceCraft cloud records.
-- Do not apply this file to the shared Twitch bot project. Use the
-- voicecraft_cloud_* tables in 202610150003_voicecraft_isolated.sql.

do $$ begin
  if to_regclass('public.voicecraft_profiles') is null
     and exists (
       select 1
       from pg_trigger as trigger
       join pg_class as relation on relation.oid = trigger.tgrelid
       join pg_namespace as namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'auth' and relation.relname = 'users'
         and trigger.tgname <> 'voicecraft_on_auth_user_created'
     ) then
    raise exception 'Refusing to add unscoped cloud tables beside an existing auth trigger.';
  end if;
end $$;

-- Optional Supabase mirror for VoiceCraft cloud records.
-- The self-hosted cloud API in services/cloud-api currently stores jobs in
-- SQLite on the VPS. This migration does not move that data and does not
-- change plan prices or existing subscription rows.
-- Apply it only when a later service is pointed at these tables.

create table if not exists public.cloud_links (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id text not null,
  platform text not null check (platform in ('ps5', 'xbox', 'bedrock')),
  player_uuid text not null,
  player_name text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.cloud_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id text not null,
  status text not null,
  confirmed integer not null default 0,
  failed_ops integer not null default 0,
  total_ops integer not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cloud_links enable row level security;
alter table public.cloud_jobs enable row level security;
revoke all on public.cloud_links from anon, authenticated;
revoke all on public.cloud_jobs from anon, authenticated;
grant select, insert, update, delete on public.cloud_links to service_role;
grant select, insert, update, delete on public.cloud_jobs to service_role;
