-- Additive desktop sign-in codes, runner-token replay protection, and reservation release.
-- Does not change plan prices, existing subscription rows, or license records.
-- Dedicated VoiceCraft databases only. The shared Twitch bot project must use
-- the voicecraft_* objects in 202610150003_voicecraft_isolated.sql.

do $$ begin
  if to_regclass('public.voicecraft_profiles') is null
     and to_regclass('public.profiles') is not null then
    raise exception 'Refusing to attach desktop auth tables to an existing non-VoiceCraft profiles table.';
  end if;
end $$;

create table if not exists public.runner_token_uses (
  jti text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.desktop_auth_codes (
  code_hash char(64) primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_challenge text not null,
  state_hash char(64) not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.runner_token_uses enable row level security;
alter table public.desktop_auth_codes enable row level security;
revoke all on table public.runner_token_uses from public, anon, authenticated;
revoke all on table public.desktop_auth_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.runner_token_uses to service_role;
grant select, insert, update, delete on table public.desktop_auth_codes to service_role;

create or replace function public.consume_runner_token(p_jti text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.runner_token_uses%rowtype;
begin
  select * into v_row from public.runner_token_uses where jti = p_jti for update;
  if not found or v_row.user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'code', 'invalid_runner_token', 'message', 'Runner authorization is invalid.');
  end if;
  if v_row.consumed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed_runner_token', 'message', 'Runner authorization was already used.');
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'expired_runner_token', 'message', 'Runner authorization has expired.');
  end if;
  update public.runner_token_uses set consumed_at = now() where jti = p_jti;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.release_builder_reservation(
  p_user_id uuid,
  p_requested_blocks integer,
  p_placed integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := (timezone('utc', now()))::date;
begin
  if p_placed is null or p_placed > 0 then
    return jsonb_build_object('ok', true, 'refunded', false, 'message', 'Partial or completed work keeps the reserved allowance.');
  end if;
  update public.daily_usage
  set task_count = greatest(0, task_count - 1),
      block_count = greatest(0, block_count - p_requested_blocks),
      updated_at = now()
  where user_id = p_user_id and usage_date = v_today;
  return jsonb_build_object('ok', true, 'refunded', true);
end;
$$;

revoke all on function public.consume_runner_token(text, uuid) from public, anon, authenticated;
revoke all on function public.release_builder_reservation(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_runner_token(text, uuid) to service_role;
grant execute on function public.release_builder_reservation(uuid, integer, integer) to service_role;
