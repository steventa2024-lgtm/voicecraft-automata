# Shared Supabase project

VoiceCraft uses the existing Twitch bot Supabase project `lzznghwmonoewimahtdq` (`https://lzznghwmonoewimahtdq.supabase.co`). Do not create another project.

## Audit of the older migrations

These files are for a dedicated VoiceCraft database. They must not be applied to the Twitch bot project:

| File | Why it is unsafe on the shared project |
| --- | --- |
| `202609010001_core_auth_billing_licenses.sql` | Replaces `public.handle_new_user()` and drops `on_auth_user_created` on `auth.users`. It also creates `public.profiles`, which may already belong to the bot. |
| `202610150001_desktop_auth_and_runner_replay.sql` | Adds foreign keys and usage functions against `public.profiles` and `public.daily_usage`. |
| `202610150002_mobile_cloud.sql` | Creates unscoped `public.cloud_links` and `public.cloud_jobs`. |

Each of those files now raises an exception when it sees an existing profile table or an existing `auth.users` trigger. That exception stops `supabase db push` before those statements run. It does not change the remote database by itself.

## What is safe to apply

`supabase/migrations/202610150003_voicecraft_isolated.sql` creates only `voicecraft_*` tables, enums, functions, policies, and the additional trigger `voicecraft_on_auth_user_created`. It does not drop or replace the bot's trigger, and it does not write to the bot's tables.

Apply that file alone in the Supabase SQL editor. Do not run `supabase db push` against this project, because the migration history would still try the older files first.

The mobile app and the cloud API use the publishable key only. The service-role key stays on the website server and is never placed in `EXPO_PUBLIC_*`.
