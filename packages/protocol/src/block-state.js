import { BLOCK_REGISTRY, TARGET_MINECRAFT } from "./block-registry.js";

export { TARGET_MINECRAFT };
export function canonicalStates(block, states) {
  if (!Object.hasOwn(BLOCK_REGISTRY, block))
    throw new Error(`Unknown Minecraft ${TARGET_MINECRAFT} block: ${block}`);
  const result = {};
  for (const key of Object.keys(states || {}).sort()) {
    const value = String(states[key]);
    if (!BLOCK_REGISTRY[block][key]?.includes(value))
      throw new Error(`Invalid ${block} property ${key}=${value}`);
    result[key] = value;
  }
  return result;
}
export function blockKey(block) {
  const states = canonicalStates(block.block, block.states);
  const properties = Object.entries(states)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return block.block + (properties ? `[${properties}]` : "");
}
export const commandBlock = (block) => `minecraft:${blockKey(block)}`;
const vectors = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
/** Transform directional properties using the exact same horizontal basis as positions. */
export function transformStates(states, transform, reflected = false) {
  if (!states) return undefined;
  const result = { ...states };
  const direction = (name) => {
    const [x, z] = transform(...vectors[name]);
    return Object.keys(vectors).find((k) => vectors[k][0] === x && vectors[k][1] === z);
  };
  if (vectors[states.facing]) result.facing = direction(states.facing);
  for (const name of Object.keys(vectors)) delete result[name];
  for (const name of Object.keys(vectors))
    if (name in states) result[direction(name)] = states[name];
  if (states.axis === "x" || states.axis === "z") {
    const [x] = transform(states.axis === "x" ? 1 : 0, states.axis === "z" ? 1 : 0);
    result.axis = x ? "x" : "z";
  }
  if (reflected) {
    if (states.hinge) result.hinge = states.hinge === "left" ? "right" : "left";
    if (states.shape?.includes("left")) result.shape = states.shape.replace("left", "right");
    else if (states.shape?.includes("right")) result.shape = states.shape.replace("right", "left");
  }
  // Straight/ascending rails also carry horizontal orientation.
  if (states.shape === "north_south" || states.shape === "east_west") {
    result.shape = ["north", "south"].includes(
      direction(states.shape === "north_south" ? "north" : "east"),
    )
      ? "north_south"
      : "east_west";
  } else if (states.shape?.startsWith("ascending_"))
    result.shape = `ascending_${direction(states.shape.slice(10))}`;
  return result;
}
export function matchesBlock(actual, expected) {
  if (!actual || actual.name !== expected.block) return false;
  const properties = actual.getProperties?.() || actual.states || {};
  return Object.entries(expected.states || {}).every(
    ([key, value]) => String(properties[key]) === String(value),
  );
}
