/**
 * Block placement engine.
 *
 * command  — operator commands, batched and rate-limited
 * creative — creative-mode hand placement
 * survival without operator rights is reported as unavailable
 */
import { Vec3 } from "vec3";
import pkg from "prismarine-item";
import {
  assertBlockId,
  executeOperations,
  isProtectedBlock,
  toFillRuns,
} from "../packages/protocol/src/index.js";

const FACES = [
  new Vec3(0, -1, 0),
  new Vec3(0, 1, 0),
  new Vec3(-1, 0, 0),
  new Vec3(1, 0, 0),
  new Vec3(0, 0, -1),
  new Vec3(0, 0, 1),
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function detectMode(bot, timeout = 1200) {
  if (process.env.PLACEMENT_MODE === "command" || process.env.PLACEMENT_MODE === "creative") {
    return process.env.PLACEMENT_MODE;
  }
  let denied = false;
  const listener = (json) => {
    const text = json?.toString?.() ?? "";
    if (/permission|unknown or incomplete command|Unknown command/i.test(text)) denied = true;
  };
  bot.on("message", listener);
  const position = bot.entity.position.floored();
  bot.chat(`/setblock ${position.x} ${Math.max(-64, position.y - 40)} ${position.z} minecraft:air`);
  await sleep(timeout);
  bot.removeListener("message", listener);
  return denied ? "creative" : "command";
}

function knownBlock(bot, name) {
  try {
    assertBlockId(name);
  } catch {
    return false;
  }
  return Boolean(bot.registry?.blocksByName?.[name] || name === "air");
}

async function placeWithCommands(bot, blocks, job, onProgress) {
  const world = [];
  let skipped = 0;
  for (const block of blocks) {
    if (!knownBlock(bot, block.block)) {
      skipped += 1;
      continue;
    }
    world.push(block);
  }
  const runs = toFillRuns(world);
  let permissionFailure = false;
  const listener = (json) => {
    const text = json?.toString?.() ?? "";
    if (/permission|unknown or incomplete command|Cannot place|out of the world/i.test(text)) permissionFailure = true;
  };
  bot.on("message", listener);
  const result = await executeOperations({
    operations: runs,
    job,
    onProgress,
    placeOne: async (run) => {
      if (permissionFailure) return { ok: false };
      const blockId = assertBlockId(run.block);
      if (run.count === 1) {
        bot.chat(`/setblock ${run.from.x} ${run.from.y} ${run.from.z} ${blockId} replace`);
      } else {
        bot.chat(
          `/fill ${run.from.x} ${run.from.y} ${run.from.z} ${run.to.x} ${run.to.y} ${run.to.z} ${blockId} replace`,
        );
      }
      await sleep(40);
      return { ok: !permissionFailure };
    },
  });
  bot.removeListener("message", listener);
  const verified = verifySample(bot, world);
  return {
    mode: "command",
    ...result,
    skipped: result.skipped + skipped,
    failed: result.failed + verified.bad + (permissionFailure ? 1 : 0),
    verified,
    status: permissionFailure || verified.bad > 0 ? "completed_with_errors" : result.status,
  };
}

function verifySample(bot, blocks) {
  if (!blocks.length || typeof bot.blockAt !== "function") return { ok: 0, bad: 0, sampled: 0 };
  const sampleCount = Math.min(12, blocks.length);
  const step = Math.max(1, Math.floor(blocks.length / sampleCount));
  let ok = 0;
  let bad = 0;
  for (let index = 0; index < blocks.length && ok + bad < sampleCount; index += step) {
    const block = blocks[index];
    const current = bot.blockAt(new Vec3(block.x, block.y, block.z));
    if (!current) {
      bad += 1;
      continue;
    }
    if (current.name === block.block) ok += 1;
    else bad += 1;
  }
  return { ok, bad, sampled: ok + bad };
}

function itemIdFor(bot, name) {
  return bot.registry.itemsByName[name]?.id ?? null;
}

async function equip(bot, name) {
  const Item = pkg(bot.version);
  const id = itemIdFor(bot, name);
  if (id == null) return false;
  await bot.creative.setInventorySlot(36, new Item(id, 1));
  await bot.equip(id, "hand").catch(() => {});
  return true;
}

function referenceFor(bot, position) {
  for (const face of FACES) {
    const ref = bot.blockAt(position.minus(face));
    if (ref && ref.boundingBox === "block" && ref.name !== "air") return { ref, face };
  }
  return null;
}

async function placeWithCreative(bot, blocks, job, onProgress) {
  if (bot.game?.gameMode && bot.game.gameMode !== "creative") {
    const error = new Error("Creative hand placement requires the bot to be in Creative mode. Survival building is not available.");
    error.code = "survival_unavailable";
    throw error;
  }
  const ordered = [...blocks].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  let equipped = null;
  return {
    mode: "creative",
    ...(await executeOperations({
      operations: ordered,
      job,
      onProgress,
      placeOne: async (block) => {
        if (isProtectedBlock(block.block)) return { ok: false, skipped: true };
        const position = new Vec3(block.x, block.y, block.z);
        if (!knownBlock(bot, block.block)) return { ok: false, skipped: true };
        if (block.block === "air") {
          const existing = bot.blockAt(position);
          if (existing && existing.name !== "air") {
            try {
              await bot.dig(existing);
            } catch {
              return { ok: false };
            }
          }
          return { ok: true };
        }
        let retried = 0;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (equipped !== block.block) {
            if (!(await equip(bot, block.block))) return { ok: false, skipped: true };
            equipped = block.block;
          }
          if (bot.entity.position.distanceTo(position) > 4.5) {
            await bot.creative.flyTo(position.offset(0.5, 2.5, 0.5)).catch(() => {});
          }
          const target = referenceFor(bot, position);
          try {
            if (!target) throw new Error("unreachable");
            await bot.placeBlock(target.ref, target.face);
            const placed = bot.blockAt(position);
            if (placed?.name === block.block) return { ok: true, retried };
          } catch {
            retried += 1;
          }
        }
        return { ok: false, retried };
      },
    })),
  };
}

export async function placeBlocks(bot, blocks, origin, job, onProgress, mode) {
  const world = origin
    ? blocks.map((block) => ({
        x: origin.x + block.x,
        y: origin.y + block.y,
        z: origin.z + block.z,
        block: block.block,
      }))
    : blocks;
  const chosen = mode ?? (await detectMode(bot));
  if (chosen === "creative") return placeWithCreative(bot, world, job, onProgress);
  if (chosen !== "command") {
    throw new Error("No supported placement mode is available.");
  }
  return placeWithCommands(bot, world, job, onProgress);
}
