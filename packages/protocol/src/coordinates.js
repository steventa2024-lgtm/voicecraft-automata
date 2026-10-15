import { WORLD_MAX_Y, WORLD_MIN_Y } from "./limits.js";

/**
 * Mineflayer yaw convention used by the existing bridge:
 * yaw 0 faces +Z, pi/2 faces -X, pi faces -Z, -pi/2 faces +X.
 */
export function facingFromYaw(yaw) {
  const x = -Math.sin(yaw);
  const z = Math.cos(yaw);
  if (Math.abs(x) > Math.abs(z)) {
    return { x: x > 0 ? 1 : -1, z: 0 };
  }
  return { x: 0, z: z > 0 ? 1 : -1 };
}

/** Right-hand vector. Facing +Z (south), right is -X (west). */
export function rightFromForward(forward) {
  return { x: -forward.z, z: forward.x };
}

export function directionVector(yaw, direction) {
  const forward = facingFromYaw(yaw);
  const right = rightFromForward(forward);
  switch (direction) {
    case "back":
      return { x: -forward.x, z: -forward.z };
    case "left":
      return { x: -right.x, z: -right.z };
    case "right":
      return right;
    case "front":
    default:
      return forward;
  }
}

export function rotateLocal(x, z, width, depth, turns) {
  const quarter = ((turns % 4) + 4) % 4;
  if (quarter === 1) return { x: depth - 1 - z, z: x, width: depth, depth: width };
  if (quarter === 2) return { x: width - 1 - x, z: depth - 1 - z, width, depth };
  if (quarter === 3) return { x: z, z: width - 1 - x, width: depth, depth: width };
  return { x, z, width, depth };
}

export function rotatedFootprint(width, depth, turns) {
  const quarter = ((turns % 4) + 4) % 4;
  return quarter % 2 === 0 ? { width, depth } : { width: depth, depth: width };
}

/**
 * Origin is the minimum corner after rotation.
 * Local +Z extends away from the player along the chosen direction.
 * Local +X extends to the player's right relative to that direction.
 * The near face (local z = 0) sits `distance` blocks from the player, centered.
 */
export function placementOrigin({ player, yaw, instruction }) {
  const footprint = rotatedFootprint(
    instruction.dimensions.width,
    instruction.dimensions.depth,
    instruction.rotation || 0,
  );
  if (instruction.position) {
    return {
      x: instruction.position.x,
      y: instruction.position.y + (instruction.offset?.y || 0),
      z: instruction.position.z,
      buildDir: directionVector(yaw, instruction.direction || "front"),
      right: rightFromForward(directionVector(yaw, instruction.direction || "front")),
      footprint,
    };
  }
  const buildDir = directionVector(yaw, instruction.direction || "front");
  const right = rightFromForward(buildDir);
  const distance = instruction.offset?.z ?? 6;
  const lateral = Math.floor(footprint.width / 2);
  return {
    x: player.x + buildDir.x * distance - right.x * lateral,
    y: player.y + (instruction.offset?.y || 0),
    z: player.z + buildDir.z * distance - right.z * lateral,
    buildDir,
    right,
    footprint,
  };
}

export function worldPosition(origin, local, rotation, width, depth) {
  const rotated = rotateLocal(local.x, local.z, width, depth, rotation || 0);
  return {
    x: origin.x + origin.right.x * rotated.x + origin.buildDir.x * rotated.z,
    y: origin.y + local.y,
    z: origin.z + origin.right.z * rotated.x + origin.buildDir.z * rotated.z,
    block: local.block,
  };
}

export function worldBoundsError(originY, height) {
  if (!Number.isFinite(originY) || !Number.isFinite(height)) return "Build height is invalid.";
  if (originY < WORLD_MIN_Y) return `Build starts at Y=${originY}, below ${WORLD_MIN_Y}.`;
  const top = originY + height - 1;
  if (top > WORLD_MAX_Y) return `Build reaches Y=${top}, above ${WORLD_MAX_Y}.`;
  return null;
}
