import {
  commandBlock,
  matchesBlock,
  canonicalStates,
} from "../packages/protocol/src/block-state.js";
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
  partitionProtectedTargets,
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
  bot.chat("/seed"); // Non-mutating operator permission probe.
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
  const runs = toFillRuns(blocks),
    sent = [];
  let permissionFailure = false,
    stoppedReason = null;
  const started = Date.now();
  const listener = (json) => {
    if (
      /permission|unknown or incomplete command|Cannot place|out of the world/i.test(
        json?.toString?.() || "",
      )
    )
      permissionFailure = true;
  };
  bot.on("message", listener);
  try {
    await executeOperations({
      operations: runs,
      job,
      placeOne: async (run) => {
        if (permissionFailure) {
          throw new Error("The server refused command placement.");
        }
        const cells = Array.from({ length: run.count }, (_, i) => ({
          x: run.from.x + i,
          y: run.from.y,
          z: run.from.z,
          block: run.block,
          ...(run.states ? { states: run.states } : {}),
        }));
        // Recheck immediately before each command, including changes made during a long build.
        if (
          cells.some((b) => {
            const current = bot.blockAt(new Vec3(b.x, b.y, b.z));
            return !current || isProtectedBlock(current.name);
          })
        )
          throw new Error(
            "A target became protected or unloaded. Placement stopped before overwriting it.",
          );
        const id = commandBlock(run);
        if (run.count === 1)
          bot.chat(`/setblock ${run.from.x} ${run.from.y} ${run.from.z} ${id} replace`);
        else
          bot.chat(
            `/fill ${run.from.x} ${run.from.y} ${run.from.z} ${run.to.x} ${run.to.y} ${run.to.z} ${id} replace`,
          );
        sent.push(...cells);
        await sleep(40);
        return { ok: !permissionFailure };
      },
      onProgress: () => {
        const check = verifySample(bot, sent);
        onProgress?.({
          requested: blocks.length,
          placed: check.ok,
          failed: 0,
          skipped: 0,
          remaining: blocks.length - check.ok,
          progress: Math.floor((check.ok / blocks.length) * 100),
          elapsedMs: Date.now() - started,
        });
      },
    });
    await sleep(200);
  } catch (error) {
    stoppedReason = error.message || "Placement stopped.";
  } finally {
    bot.removeListener("message", listener);
  }
  const verified = verifySample(bot, sent),
    remaining = blocks.length - sent.length;
  const status = job.cancelled
    ? "cancelled"
    : permissionFailure || stoppedReason || verified.bad
      ? verified.ok > 0
        ? "completed_with_errors"
        : "failed"
      : "completed";
  const result = {
    mode: "command",
    error: stoppedReason,
    requested: blocks.length,
    placed: verified.ok,
    failed: verified.bad + (stoppedReason ? remaining : 0),
    skipped: 0,
    retried: 0,
    remaining: stoppedReason ? 0 : remaining,
    elapsedMs: Date.now() - started,
    progress: Math.floor((verified.ok / blocks.length) * 100),
    verified,
    status,
  };
  onProgress?.(result);
  return result;
}

function verifySample(bot, blocks) {
  if (!blocks.length || typeof bot.blockAt !== "function") return { ok: 0, bad: 0, sampled: 0 };
  const sampleCount = blocks.length;
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
    if (matchesBlock(current, block)) ok += 1;
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
    const error = new Error(
      "Creative hand placement requires the bot to be in Creative mode. Survival building is not available.",
    );
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
        ...block,
        x: origin.x + block.x,
        y: origin.y + block.y,
        z: origin.z + block.z,
        block: block.block,
      }))
    : blocks;
  // Validate every block before sending any mutation to the server.
  for (const block of world) {
    canonicalStates(block.block, block.states);
    if (!knownBlock(bot, block.block))
      throw new Error(
        "The connected Minecraft version does not support " +
          block.block +
          ". This plan targets Java 1.21.1.",
      );
  }
  const guarded = partitionProtectedTargets(
    world,
    (block) => bot.blockAt?.(new Vec3(block.x, block.y, block.z))?.name ?? null,
  );
  const chosen = mode ?? (await detectMode(bot));
  if (chosen === "creative" && world.some((b) => Object.keys(b.states || {}).length)) {
    throw new Error(
      "This architectural plan requires command placement to preserve exact block states. Enable operator command placement on your Java server; no blocks were changed.",
    );
  }
  const placed =
    chosen === "creative"
      ? await placeWithCreative(bot, guarded.place, job, onProgress)
      : chosen === "command"
        ? await placeWithCommands(bot, guarded.place, job, onProgress)
        : null;
  if (!placed) throw new Error("No supported placement mode is available.");
  return {
    ...placed,
    skipped: (placed.skipped || 0) + guarded.skipped.length,
    protectedSkipped: guarded.skipped.length,
  };
}
