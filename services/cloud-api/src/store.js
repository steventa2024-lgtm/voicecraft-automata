import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { HttpError } from "./errors.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function hashCode(code, pepper) {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

function code() {
  const bytes = randomBytes(8);
  return [...bytes].map((value) => ALPHABET[value % ALPHABET.length]).join("");
}

export function openCloudStore(directory, pepper) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "cloud.sqlite"));
  db.exec("pragma journal_mode = wal; pragma busy_timeout = 3000;");
  db.exec(`
    create table if not exists profiles (
      user_id text primary key,
      email text not null,
      plan_tier text,
      subscription_status text,
      unlimited_tester integer not null default 0
    );
    create table if not exists usage_daily (
      user_id text not null,
      day text not null,
      task_count integer not null default 0,
      block_count integer not null default 0,
      primary key (user_id, day)
    );
    create table if not exists worlds (
      id text primary key,
      name text not null
    );
    create table if not exists pairing_challenges (
      code_hash text primary key,
      world_id text not null,
      platform text not null,
      player_uuid text not null,
      player_name text not null,
      expires_at integer not null,
      consumed_by text
    );
    create table if not exists links (
      id text primary key,
      user_id text not null,
      world_id text not null,
      platform text not null,
      player_uuid text not null,
      player_name text not null,
      created_at integer not null,
      revoked_at integer
    );
    create table if not exists previews (
      id text primary key,
      user_id text not null,
      world_id text not null,
      link_id text not null,
      summary text not null,
      instruction_json text not null,
      block_count integer not null,
      width integer not null,
      depth integer not null,
      height integer not null,
      floors integer,
      material text,
      structure text,
      warnings_json text not null,
      created_at integer not null,
      expires_at integer not null
    );
    create table if not exists jobs (
      id text primary key,
      user_id text not null,
      world_id text not null,
      preview_id text not null,
      idempotency_key text,
      status text not null,
      confirmed integer not null default 0,
      failed_ops integer not null default 0,
      total_ops integer not null,
      error text,
      created_at integer not null,
      updated_at integer not null
    );
    create table if not exists blueprints (
      id text primary key,
      user_id text not null,
      name text not null,
      category text not null,
      summary text not null,
      instruction_json text not null,
      block_count integer not null,
      favorite integer not null default 0,
      created_at integer not null,
      last_used_at integer
    );
    create unique index if not exists jobs_idempo on jobs(user_id, idempotency_key) where idempotency_key is not null;
  `);

  const day = () => new Date().toISOString().slice(0, 10);

  function transaction(run) {
    db.exec("begin immediate");
    try {
      const result = run();
      db.exec("commit");
      return result;
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }

  return {
    close() {
      db.close();
    },
    setProfile(profile) {
      db.prepare(`
        insert into profiles (user_id, email, plan_tier, subscription_status, unlimited_tester)
        values (?, ?, ?, ?, ?)
        on conflict(user_id) do update set
          email = excluded.email,
          plan_tier = excluded.plan_tier,
          subscription_status = excluded.subscription_status,
          unlimited_tester = excluded.unlimited_tester
      `).run(profile.userId, profile.email, profile.planTier, profile.subscriptionStatus, profile.unlimitedTester ? 1 : 0);
    },
    accountState(userId) {
      const profile = db.prepare("select * from profiles where user_id = ?").get(userId);
      const usage = db.prepare("select task_count, block_count from usage_daily where user_id = ? and day = ?").get(userId, day());
      return {
        profile: profile
          ? {
              plan_tier: profile.plan_tier,
              subscription_status: profile.subscription_status,
              unlimited_tester: Boolean(profile.unlimited_tester),
            }
          : null,
        usage: { task_count: usage?.task_count || 0, block_count: usage?.block_count || 0 },
      };
    },
    saveUsage(userId, usage) {
      db.prepare(`
        insert into usage_daily (user_id, day, task_count, block_count) values (?, ?, ?, ?)
        on conflict(user_id, day) do update set task_count = excluded.task_count, block_count = excluded.block_count
      `).run(userId, day(), usage.task_count || 0, usage.block_count || 0);
    },
    issuePairing({ worldId, worldName, platform, playerUuid, playerName, ttlMs = 5 * 60_000 }) {
      const plain = code();
      const now = Date.now();
      transaction(() => {
        db.prepare("insert into worlds (id, name) values (?, ?) on conflict(id) do update set name = excluded.name").run(worldId, worldName);
        db.prepare(`
          insert into pairing_challenges (code_hash, world_id, platform, player_uuid, player_name, expires_at)
          values (?, ?, ?, ?, ?, ?)
        `).run(hashCode(plain, pepper), worldId, platform, playerUuid, playerName, now + ttlMs);
      });
      return { code: plain, expiresAt: now + ttlMs };
    },
    claimPairing({ userId, code: plain, platform }) {
      return transaction(() => {
        const row = db.prepare("select * from pairing_challenges where code_hash = ?").get(hashCode(plain, pepper));
        if (!row || row.consumed_by || row.expires_at < Date.now()) {
          throw new HttpError(400, "That pairing code is invalid, expired, or already used.");
        }
        if (row.platform !== platform) {
          throw new HttpError(400, "Choose the same console that joined the server.");
        }
        const existing = db.prepare("select user_id from links where player_uuid = ? and revoked_at is null").get(row.player_uuid);
        if (existing && existing.user_id !== userId) {
          throw new HttpError(409, "That Minecraft player is already linked to another account.");
        }
        db.prepare("update pairing_challenges set consumed_by = ? where code_hash = ?").run(userId, row.code_hash);
        const id = randomUUID();
        db.prepare("update links set revoked_at = ? where user_id = ? and revoked_at is null").run(Date.now(), userId);
        db.prepare(`
          insert into links (id, user_id, world_id, platform, player_uuid, player_name, created_at)
          values (?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, row.world_id, row.platform, row.player_uuid, row.player_name, Date.now());
        const world = db.prepare("select name from worlds where id = ?").get(row.world_id);
        return {
          linkId: id,
          worldId: row.world_id,
          worldName: world.name,
          platform: row.platform,
          playerName: row.player_name,
          playerUuid: row.player_uuid,
        };
      });
    },
    activeLink(userId) {
      return db.prepare(`
        select links.*, worlds.name as world_name from links
        join worlds on worlds.id = links.world_id
        where links.user_id = ? and links.revoked_at is null
        order by links.created_at desc limit 1
      `).get(userId) || null;
    },
    revokeLink(userId) {
      db.prepare("update links set revoked_at = ? where user_id = ? and revoked_at is null").run(Date.now(), userId);
    },
    savePreview(row) {
      db.prepare(`
        insert into previews (
          id, user_id, world_id, link_id, summary, instruction_json, block_count,
          width, depth, height, floors, material, structure, warnings_json, created_at, expires_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.id, row.userId, row.worldId, row.linkId, row.summary, row.instructionJson, row.blockCount,
        row.width, row.depth, row.height, row.floors, row.material, row.structure, row.warningsJson,
        row.createdAt, row.expiresAt,
      );
    },
    previewForUser(id, userId) {
      return db.prepare("select * from previews where id = ? and user_id = ?").get(id, userId) || null;
    },
    createJob({ userId, worldId, previewId, idempotencyKey, total, charge }) {
      return transaction(() => {
        if (idempotencyKey) {
          const prior = db.prepare("select * from jobs where user_id = ? and idempotency_key = ?").get(userId, idempotencyKey);
          if (prior) {
            if (prior.preview_id !== previewId) throw new HttpError(409, "That idempotency key was already used for a different preview.");
            return { job: prior, created: false };
          }
        }
        if (charge) {
          const today = day();
          const usage = db.prepare("select task_count, block_count from usage_daily where user_id = ? and day = ?").get(userId, today);
          db.prepare(`
            insert into usage_daily (user_id, day, task_count, block_count) values (?, ?, ?, ?)
            on conflict(user_id, day) do update set task_count = excluded.task_count, block_count = excluded.block_count
          `).run(
            userId,
            today,
            (usage?.task_count || 0) + charge.tasks,
            (usage?.block_count || 0) + charge.blocks,
          );
        }
        const id = randomUUID();
        const now = Date.now();
        db.prepare(`
          insert into jobs (id, user_id, world_id, preview_id, idempotency_key, status, total_ops, created_at, updated_at)
          values (?, ?, ?, ?, ?, 'queued', ?, ?, ?)
        `).run(id, userId, worldId, previewId, idempotencyKey, total, now, now);
        return { job: db.prepare("select * from jobs where id = ?").get(id), created: true };
      });
    },
    jobForUser(id, userId) {
      return db.prepare("select * from jobs where id = ? and user_id = ?").get(id, userId) || null;
    },
    jobByIdempotency(userId, key) {
      if (!key) return null;
      return db.prepare("select * from jobs where user_id = ? and idempotency_key = ?").get(userId, key) || null;
    },
    activeJob(userId) {
      return db.prepare(`
        select * from jobs where user_id = ? and status in ('queued', 'building', 'cancelling')
        order by created_at desc limit 1
      `).get(userId) || null;
    },
    recentJobs(userId) {
      return db.prepare("select * from jobs where user_id = ? order by created_at desc limit 20").all(userId);
    },
    requestCancel(id, userId) {
      const job = this.jobForUser(id, userId);
      if (!job) throw new HttpError(404, "That build was not found.");
      if (job.status === "queued") {
        const preview = this.previewById(job.preview_id);
        this.finishJob(job.id, {
          status: "cancelled",
          confirmed: 0,
          failed: 0,
          error: "Cancelled before execution. No blocks were placed.",
          refundBlocks: preview?.block_count || 0,
        });
      } else if (job.status === "building") {
        db.prepare("update jobs set status = 'cancelling', updated_at = ? where id = ?").run(Date.now(), id);
      } else if (job.status !== "cancelling") {
        throw new HttpError(409, "This build can no longer be cancelled.");
      }
      return this.jobForUser(id, userId);
    },
    claimNextJob() {
      return transaction(() => {
        const job = db.prepare("select * from jobs where status = 'queued' order by created_at asc limit 1").get();
        if (!job) return null;
        db.prepare("update jobs set status = 'building', updated_at = ? where id = ? and status = 'queued'").run(Date.now(), job.id);
        return db.prepare("select * from jobs where id = ?").get(job.id);
      });
    },
    jobById(id) {
      return db.prepare("select * from jobs where id = ?").get(id);
    },
    previewById(id) {
      return db.prepare("select * from previews where id = ?").get(id);
    },
    finishJob(id, { status, confirmed, failed, error, refundBlocks }) {
      transaction(() => {
        const job = db.prepare("select * from jobs where id = ?").get(id);
        if (!job || job.status === "cancelled" || job.status === "completed" || job.status === "failed") return;
        const next = job.status === "cancelling" && status !== "failed" ? "cancelled" : status;
        db.prepare(`
          update jobs set status = ?, confirmed = ?, failed_ops = ?, error = ?, updated_at = ? where id = ?
        `).run(next, confirmed, failed, error || null, Date.now(), id);
        if (refundBlocks && confirmed === 0) {
          const usage = db.prepare("select * from usage_daily where user_id = ? and day = ?").get(job.user_id, day());
          if (usage) {
            db.prepare("update usage_daily set task_count = ?, block_count = ? where user_id = ? and day = ?").run(
              Math.max(0, usage.task_count - 1),
              Math.max(0, usage.block_count - refundBlocks),
              job.user_id,
              day(),
            );
          }
        }
      });
    },
    saveBlueprint(row) {
      const id = randomUUID();
      db.prepare(`
        insert into blueprints (id, user_id, name, category, summary, instruction_json, block_count, favorite, created_at)
        values (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, row.userId, row.name, row.category, row.summary, row.instructionJson, row.blockCount, Date.now());
      return id;
    },
    blueprints(userId) {
      return db.prepare("select * from blueprints where user_id = ? order by created_at desc").all(userId);
    },
    blueprint(id, userId) {
      return db.prepare("select * from blueprints where id = ? and user_id = ?").get(id, userId) || null;
    },
    renameBlueprint(id, userId, name) {
      const result = db.prepare("update blueprints set name = ? where id = ? and user_id = ?").run(name, id, userId);
      if (result.changes !== 1) throw new HttpError(404, "Blueprint was not found.");
    },
    favoriteBlueprint(id, userId, favorite) {
      const result = db.prepare("update blueprints set favorite = ? where id = ? and user_id = ?").run(favorite ? 1 : 0, id, userId);
      if (result.changes !== 1) throw new HttpError(404, "Blueprint was not found.");
    },
    deleteBlueprint(id, userId) {
      const result = db.prepare("delete from blueprints where id = ? and user_id = ?").run(id, userId);
      if (result.changes !== 1) throw new HttpError(404, "Blueprint was not found.");
    },
    touchBlueprint(id, userId) {
      db.prepare("update blueprints set last_used_at = ? where id = ? and user_id = ?").run(Date.now(), id, userId);
    },
  };
}
