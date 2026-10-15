/**
 * Build execution against a live Mineflayer bot.
 * Planning itself lives in @zeropulse/protocol so previews cannot drift from execution.
 */
import { Vec3 } from "vec3";
import { placeBlocks } from "./placer.js";
import {
  assertPlanFitsWorld,
  buildPlan,
  placementOrigin,
  surveyTerrain,
  worldPosition,
} from "../packages/protocol/src/index.js";

function playerPosition(bot) {
  const position = bot.entity.position.floored();
  return { x: position.x, y: position.y, z: position.z, yaw: bot.entity.yaw };
}

export function planInstruction(bot, instruction) {
  const planning = instruction.action === "clear" ? instruction : { ...instruction, action: "build", valid: true };
  const plan = buildPlan(planning);
  const originInfo = placementOrigin({ player: playerPosition(bot), yaw: bot.entity.yaw, instruction: planning });
  assertPlanFitsWorld(originInfo.y, plan);
  const worldBlocks = plan.blocks.map((block) =>
    worldPosition(originInfo, block, instruction.rotation || 0, instruction.dimensions.width, instruction.dimensions.depth),
  );
  const site = surveyTerrain({
    origin: { ...originInfo, y: originInfo.y + plan.bounds.min.y },
    width: originInfo.footprint.width,
    depth: originInfo.footprint.depth,
    height: plan.bounds.height,
    sampler: (x, y, z) => bot.blockAt(new Vec3(x, y, z))?.name ?? null,
  });
  return { plan, origin: originInfo, worldBlocks, site };
}

export async function runBuild(bot, instruction, job, onProgress, mode, hooks = {}) {
  const prepared = planInstruction(bot, instruction);
  if (prepared.site.protectedCount > 0 && instruction.protectedBlockPolicy !== "skip") {
    const error = new Error("Protected blocks are inside the footprint.");
    error.code = "protected_blocks";
    error.site = prepared.site;
    throw error;
  }
  hooks.onSite?.(prepared.site);
  const snapshot = await hooks.capture?.(prepared.worldBlocks);
  const result = await placeBlocks(bot, prepared.worldBlocks, null, job, onProgress, mode);
  return { ...result, origin: prepared.origin, total: prepared.plan.count, site: prepared.site, snapshot };
}

export async function clearArea(bot, instruction, job, onProgress, mode, hooks = {}) {
  return runBuild(bot, { ...instruction, action: "clear" }, job, onProgress, mode, hooks);
}
