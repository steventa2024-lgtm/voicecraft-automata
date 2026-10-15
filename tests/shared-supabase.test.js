import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const isolated = readFileSync("supabase/migrations/202610150003_voicecraft_isolated.sql", "utf8");
const isolatedSql = isolated.replace(/--.*$/gm, "");
const older = [
  "supabase/migrations/202609010001_core_auth_billing_licenses.sql",
  "supabase/migrations/202610150001_desktop_auth_and_runner_replay.sql",
  "supabase/migrations/202610150002_mobile_cloud.sql",
].map((file) => readFileSync(file, "utf8"));

test("the shared-project migration does not replace Twitch bot auth objects", () => {
  assert.match(isolated, /voicecraft_on_auth_user_created/);
  assert.match(isolated, /function public\.voicecraft_handle_new_user/);
  assert.doesNotMatch(isolatedSql, /drop trigger if exists on_auth_user_created/i);
  assert.doesNotMatch(isolatedSql, /function public\.handle_new_user/i);
  assert.doesNotMatch(isolatedSql, /\btruncate\b/i);
  assert.doesNotMatch(isolatedSql, /drop table/i);
  assert.doesNotMatch(isolatedSql, /delete from/i);
  assert.doesNotMatch(isolatedSql, /insert into public\.profiles/i);
  assert.doesNotMatch(isolatedSql, /update public\.profiles/i);
  for (const sql of older) {
    assert.match(sql, /raise exception/);
    assert.match(sql, /lzznghwmonoewimahtdq|non-VoiceCraft|existing auth trigger/);
  }
});

test("application queries use the voicecraft table prefix", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".output") continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
    }
  };
  walk("src");
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (/\.from\("profiles"\)|\.from\("daily_usage"\)|\.from\("license_keys"\)|\.rpc\("verify_and_consume_builder_run"\)|\.rpc\("handle_new_user"\)/.test(text)) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});
