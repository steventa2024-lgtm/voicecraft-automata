import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MAX_BLUEPRINTS, MAX_HISTORY_BLOCKS, MAX_HISTORY_BUILDS } from "../packages/protocol/src/limits.js";
import { planRedo, planUndo } from "../packages/protocol/src/history.js";

export function openStore(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "zeropulse.sqlite"));
  db.exec("pragma journal_mode = wal; pragma busy_timeout = 3000;");
  db.exec(`
    create table if not exists builds (
      id text primary key,
      world_key text not null,
      action text not null,
      structure text,
      material text,
      status text not null,
      origin_json text,
      block_count integer not null default 0,
      placed integer not null default 0,
      failed integer not null default 0,
      started_at text not null,
      finished_at text,
      undo_available integer not null default 0,
      note text
    );
    create table if not exists block_changes (
      build_id text not null,
      x integer not null,
      y integer not null,
      z integer not null,
      before_name text not null,
      after_name text not null
    );
    create table if not exists blueprints (
      id text primary key,
      name text not null,
      category text not null,
      structure text not null,
      material text not null,
      size text not null,
      floors integer not null,
      width integer not null,
      depth integer not null,
      height integer not null,
      favorite integer not null default 0,
      notes text not null default '',
      created_at text not null
    );
    create table if not exists devices (
      id text primary key,
      name text not null,
      public_key text not null,
      paired_at text not null,
      revoked_at text
    );
  `);
  for (const [name, type] of [
    ["template_id", "text"],
    ["template_options", "text"],
  ]) {
    const columns = db.prepare(`pragma table_info(blueprints)`).all();
    if (!columns.some((column) => column.name === name)) db.exec(`alter table blueprints add column ${name} ${type}`);
  }

  return {
    recordBuild(entry, changes) {
      const id = entry.id || randomUUID();
      const kept = changes.slice(0, MAX_HISTORY_BLOCKS);
      const undoAvailable = kept.length > 0 && kept.length === changes.length;
      db.prepare(
        `insert into builds (id, world_key, action, structure, material, status, origin_json, block_count, placed, failed, started_at, finished_at, undo_available, note)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        entry.worldKey || "unknown",
        entry.action,
        entry.structure || null,
        entry.material || null,
        entry.status,
        JSON.stringify(entry.origin || null),
        entry.blockCount || kept.length,
        entry.placed || 0,
        entry.failed || 0,
        entry.startedAt || new Date().toISOString(),
        entry.finishedAt || new Date().toISOString(),
        undoAvailable ? 1 : 0,
        undoAvailable ? entry.note || null : "Undo snapshot was truncated or unavailable.",
      );
      const insert = db.prepare(
        `insert into block_changes (build_id, x, y, z, before_name, after_name) values (?, ?, ?, ?, ?, ?)`,
      );
      for (const change of kept) {
        insert.run(id, change.x, change.y, change.z, change.before, change.after);
      }
      const extra = db.prepare(`select id from builds order by started_at desc`).all();
      for (const row of extra.slice(MAX_HISTORY_BUILDS)) {
        db.prepare(`delete from block_changes where build_id = ?`).run(row.id);
        db.prepare(`delete from builds where id = ?`).run(row.id);
      }
      return { id, undoAvailable };
    },
    listBuilds() {
      return db.prepare(`select * from builds order by started_at desc limit ?`).all(MAX_HISTORY_BUILDS);
    },
    changesFor(buildId) {
      return db
        .prepare(`select x, y, z, before_name as before, after_name as after from block_changes where build_id = ?`)
        .all(buildId)
        .map((row) => ({ x: row.x, y: row.y, z: row.z, before: row.before, after: row.after }));
    },
    latestUndo(worldKey) {
      return db
        .prepare(
          `select * from builds where world_key = ? and undo_available = 1 and status in ('completed', 'completed_with_errors', 'cancelled') order by started_at desc limit 1`,
        )
        .get(worldKey);
    },
    prepareUndo(worldKey, currentAt) {
      const build = this.latestUndo(worldKey);
      if (!build) return { available: false, reason: "No build history is available to undo.", operations: [] };
      const plan = planUndo(this.changesFor(build.id), currentAt);
      return { ...plan, buildId: build.id };
    },
    prepareRedo(worldKey, currentAt) {
      const build = db
        .prepare(`select * from builds where world_key = ? order by started_at desc limit 1`)
        .get(worldKey);
      if (!build) return { available: false, reason: "Nothing to redo.", operations: [] };
      return { ...planRedo(this.changesFor(build.id), currentAt), buildId: build.id };
    },
    saveBlueprint(blueprint) {
      const count = db.prepare(`select count(*) as count from blueprints`).get().count;
      if (count >= MAX_BLUEPRINTS) throw new Error("Blueprint library is full.");
      const id = blueprint.id || randomUUID();
      db.prepare(
        `insert into blueprints (id, name, category, structure, material, size, floors, width, depth, height, favorite, notes, created_at, template_id, template_options)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        blueprint.name,
        blueprint.category,
        blueprint.structure,
        blueprint.material,
        blueprint.size,
        blueprint.floors,
        blueprint.dimensions.width,
        blueprint.dimensions.depth,
        blueprint.dimensions.height,
        blueprint.favorite ? 1 : 0,
        blueprint.notes || "",
        new Date().toISOString(),
        blueprint.templateId || null,
        blueprint.templateOptions ? JSON.stringify(blueprint.templateOptions) : null,
      );
      return id;
    },
    listBlueprints() {
      return db.prepare(`select * from blueprints order by favorite desc, created_at desc`).all();
    },
    duplicateBlueprint(id) {
      const row = db.prepare(`select * from blueprints where id = ?`).get(id);
      if (!row) throw new Error("Blueprint was not found.");
      return this.saveBlueprint({
        name: `${row.name} copy`,
        category: row.category,
        structure: row.structure,
        material: row.material,
        size: row.size,
        floors: row.floors,
        dimensions: { width: row.width, depth: row.depth, height: row.height },
        favorite: false,
        notes: row.notes,
        templateId: row.template_id || undefined,
        templateOptions: row.template_options ? JSON.parse(row.template_options) : undefined,
      });
    },
    deleteBlueprint(id) {
      db.prepare(`delete from blueprints where id = ?`).run(id);
    },
    setFavorite(id, favorite) {
      db.prepare(`update blueprints set favorite = ? where id = ?`).run(favorite ? 1 : 0, id);
    },
    saveDevice(device) {
      db.prepare(
        `insert into devices (id, name, public_key, paired_at, revoked_at) values (?, ?, ?, ?, null)
         on conflict(id) do update set name = excluded.name, public_key = excluded.public_key, revoked_at = null`,
      ).run(device.id, device.name, device.publicKey, new Date().toISOString());
    },
    revokeDevice(id) {
      db.prepare(`update devices set revoked_at = ? where id = ?`).run(new Date().toISOString(), id);
    },
    listDevices() {
      return db.prepare(`select id, name, public_key, paired_at, revoked_at from devices`).all();
    },
    close() {
      db.close();
    },
  };
}
