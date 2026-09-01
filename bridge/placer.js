/**
 * Block placement engine.
 *
 * Two real placement paths, picked automatically at build time:
 *
 *  1. "command"  — the bot has operator rights, so it issues /fill and /setblock.
 *                  Fastest and exact; used on servers or LAN worlds with cheats on.
 *  2. "creative" — no operator rights: the bot pulls the block into its hotbar with
 *                  the creative inventory API, flies to the target and calls
 *                  bot.placeBlock() against a neighbouring face. Real survival-style
 *                  placement, slower but works without cheats.
 *
 * Both paths mutate the actual world — nothing here is simulated.
 */
import { Vec3 } from "vec3";
import pkg from "prismarine-item";

const FACES = [
  new Vec3(0, -1, 0),
  new Vec3(0, 1, 0),
  new Vec3(-1, 0, 0),
  new Vec3(1, 0, 0),
  new Vec3(0, 0, -1),
  new Vec3(0, 0, 1),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------- capability */

/**
 * Probe operator rights by trying a harmless /setblock far below the world and
 * watching for a permission / unknown-command response.
 */
export async function detectMode(bot, timeout = 1200) {
  if (process.env.PLACEMENT_MODE) return process.env.PLACEMENT_MODE;

  let denied = false;
  const listener = (json) => {
    const text = json?.toString?.() ?? "";
    if (/permission|unknown or incomplete command|Unknown command/i.test(text)) denied = true;
  };
  bot.on("message", listener);

  const p = bot.entity.position.floored();
  bot.chat(`/setblock ${p.x} ${Math.max(-63, p.y - 40)} ${p.z} minecraft:air replace`);
  await sleep(timeout);
  bot.removeListener("message", listener);

  return denied ? "creative" : "command";
}

/* ------------------------------------------------------------- command */

/** Collapse a placement list into /fill-able runs along X, then Z. */
export function toFillRuns(blocks) {
  const key = (b) => `${b.y}|${b.z}|${b.block}`;
  const rows = new Map();
  for (const b of blocks) {
    const k = key(b);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(b);
  }

  const runs = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    let start = row[0];
    let prev = row[0];
    for (let i = 1; i <= row.length; i += 1) {
      const cur = row[i];
      if (cur && cur.x === prev.x + 1) {
        prev = cur;
        continue;
      }
      runs.push({
        from: { x: start.x, y: start.y, z: start.z },
        to: { x: prev.x, y: prev.y, z: prev.z },
        block: start.block,
        count: prev.x - start.x + 1,
      });
      if (!cur) break;
      start = cur;
      prev = cur;
    }
  }
  return runs;
}

async function placeWithCommands(bot, blocks, origin, job, onProgress) {
  const world = blocks.map((b) => ({
    x: origin.x + b.x,
    y: origin.y + b.y,
    z: origin.z + b.z,
    block: b.block,
  }));
  const runs = toFillRuns(world);
  const total = blocks.length;
  let placed = 0;

  for (let i = 0; i < runs.length; i += 1) {
    if (job.cancelled) return placed;
    const r = runs[i];
    if (r.count === 1 || process.env.DISABLE_FILL === "1") {
      // Some servers restrict /fill — fall back to per-block setblock.
      for (let x = r.from.x; x <= r.to.x; x += 1) {
        bot.chat(`/setblock ${x} ${r.from.y} ${r.from.z} minecraft:${r.block} replace`);
        if ((x - r.from.x) % 12 === 11) await sleep(60);
      }
    } else {
      bot.chat(
        `/fill ${r.from.x} ${r.from.y} ${r.from.z} ${r.to.x} ${r.to.y} ${r.to.z} minecraft:${r.block} replace`,
      );
    }
    placed += r.count;
    // Stay under the vanilla chat rate limit.
    if (i % 8 === 7) {
      onProgress?.(placed, total);
      await sleep(120);
    }
  }
  onProgress?.(total, total);
  return placed;
}

/* ------------------------------------------------------------ creative */

function itemIdFor(bot, name) {
  const item = bot.registry.itemsByName[name] ?? bot.registry.itemsByName[name.replace(/^.*:/, "")];
  return item?.id ?? null;
}

async function equip(bot, name) {
  const Item = pkg(bot.version);
  const id = itemIdFor(bot, name);
  if (id == null) return false;
  await bot.creative.setInventorySlot(36, new Item(id, 1));
  await bot.equip(id, "hand").catch(() => {});
  return true;
}

/** Find a solid neighbour we can click to place at `pos`. */
function referenceFor(bot, pos) {
  for (const face of FACES) {
    const ref = bot.blockAt(pos.minus(face));
    if (ref && ref.boundingBox === "block" && ref.name !== "air") {
      return { ref, face };
    }
  }
  return null;
}

async function placeWithCreative(bot, blocks, origin, job, onProgress) {
  const total = blocks.length;
  let placed = 0;
  let equipped = null;

  // Build bottom-up so every block has support to click against.
  const ordered = [...blocks].sort((a, b) => a.y - b.y);

  for (const b of ordered) {
    if (job.cancelled) return placed;
    const pos = new Vec3(origin.x + b.x, origin.y + b.y, origin.z + b.z);

    if (b.block === "air") {
      const existing = bot.blockAt(pos);
      if (existing && existing.name !== "air") await bot.dig(existing).catch(() => {});
      placed += 1;
      continue;
    }

    if (equipped !== b.block) {
      if (!(await equip(bot, b.block))) continue;
      equipped = b.block;
    }

    if (bot.entity.position.distanceTo(pos) > 4) {
      await bot.creative.flyTo(pos.offset(0.5, 2.5, 0.5)).catch(() => {});
    }

    const target = referenceFor(bot, pos);
    if (target) {
      await bot.placeBlock(target.ref, target.face).catch(() => {});
    } else {
      // Nothing to click against — drop a temporary support underneath.
      await bot.creative.flyTo(pos.offset(0.5, 1.5, 0.5)).catch(() => {});
      const below = bot.blockAt(pos.offset(0, -1, 0));
      if (below && below.name !== "air") {
        await bot.placeBlock(below, new Vec3(0, 1, 0)).catch(() => {});
      }
    }

    placed += 1;
    if (placed % 8 === 0) {
      onProgress?.(placed, total);
      await sleep(30);
    }
  }
  onProgress?.(total, total);
  return placed;
}

/* -------------------------------------------------------------- public */

export async function placeBlocks(bot, blocks, origin, job, onProgress, mode) {
  const chosen = mode ?? (await detectMode(bot));
  if (chosen === "creative") {
    return { mode: chosen, placed: await placeWithCreative(bot, blocks, origin, job, onProgress) };
  }
  return { mode: "command", placed: await placeWithCommands(bot, blocks, origin, job, onProgress) };
}
