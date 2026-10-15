import { placementOrigin, worldPosition } from "../../packages/protocol/src/coordinates.js";

export function worldBlocksFromPlan(plan, instruction, player, yaw) {
  const origin = placementOrigin({ player, yaw, instruction });
  return plan.blocks.map((block) =>
    worldPosition(origin, block, instruction.rotation || 0, instruction.dimensions.width, instruction.dimensions.depth),
  );
}

export function playerFromBot(bot, playerName) {
  const listed = bot.players?.[playerName];
  const entity = listed?.entity || bot.entity;
  if (!entity?.position) return null;
  return {
    x: Math.floor(entity.position.x),
    y: Math.floor(entity.position.y),
    z: Math.floor(entity.position.z),
    yaw: entity.yaw ?? bot.entity?.yaw ?? 0,
    uuid: listed?.uuid || null,
  };
}
