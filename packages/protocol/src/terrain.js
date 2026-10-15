import { isProtectedBlock } from "./limits.js";

const LIQUIDS = new Set(["water", "lava"]);
const TREE_BLOCKS = new Set(["oak_log", "spruce_log", "birch_log", "jungle_log", "acacia_log", "dark_oak_log", "cherry_log", "mangrove_log", "oak_leaves", "spruce_leaves", "birch_leaves", "jungle_leaves", "acacia_leaves", "dark_oak_leaves", "cherry_leaves", "mangrove_leaves", "azalea_leaves"]);

function baseName(name) {
  return String(name || "air").replace(/^minecraft:/, "");
}

/**
 * Inspect a footprint using a caller-supplied sampler.
 * sampler(x, y, z) returns a block name or null when the chunk is unloaded.
 */
export function surveyTerrain({ origin, width, depth, height, sampler, protectedExtra = [] }) {
  const extra = new Set(protectedExtra.map(baseName));
  const columns = [];
  let unloaded = 0;
  let water = 0;
  let lava = 0;
  let trees = 0;
  let occupied = 0;
  let excavation = 0;
  const protectedBlocks = [];
  const elevations = [];

  for (let x = 0; x < width; x += 1) {
    for (let z = 0; z < depth; z += 1) {
      let ground = null;
      for (let y = origin.y + 8; y >= origin.y - 12; y -= 1) {
        const name = sampler(origin.x + x, y, origin.z + z);
        if (name == null) {
          unloaded += 1;
          break;
        }
        const block = baseName(name);
        if (block !== "air" && !LIQUIDS.has(block) && !block.endsWith("_leaves")) {
          ground = y;
          break;
        }
      }
      const elevation = ground == null ? origin.y : ground + 1;
      elevations.push(elevation);
      columns.push({ x: origin.x + x, z: origin.z + z, elevation });

      for (let y = 0; y < height; y += 1) {
        const worldY = origin.y + y;
        const sample = sampler(origin.x + x, worldY, origin.z + z);
        if (sample == null) {
          unloaded += 1;
          continue;
        }
        const block = baseName(sample);
        if (block === "air") continue;
        occupied += 1;
        if (block === "water") water += 1;
        if (block === "lava") lava += 1;
        if (TREE_BLOCKS.has(block) || block.endsWith("_log") || block.endsWith("_leaves")) trees += 1;
        if (isProtectedBlock(block) || extra.has(block)) {
          protectedBlocks.push({ block, x: origin.x + x, y: worldY, z: origin.z + z });
        }
        if (worldY >= elevation && block !== "air") excavation += 1;
      }
    }
  }

  const minElevation = elevations.length ? Math.min(...elevations) : origin.y;
  const maxElevation = elevations.length ? Math.max(...elevations) : origin.y;
  const slope = maxElevation - minElevation;
  const warnings = [];
  if (unloaded > 0) warnings.push("Some chunks in the footprint are not loaded. Move closer and survey again.");
  if (lava > 0) warnings.push(`Lava occupies ${lava} blocks in the footprint.`);
  if (water > 0) warnings.push(`Water occupies ${water} blocks in the footprint.`);
  if (trees > 0) warnings.push(`Trees or leaves occupy ${trees} blocks.`);
  if (slope > 2) warnings.push(`Terrain slope across the footprint is ${slope} blocks.`);
  if (protectedBlocks.length > 0) {
    warnings.push(`${protectedBlocks.length} protected blocks must be skipped or the build aborted.`);
  }
  if (occupied > 0) warnings.push("The footprint is not empty. Approval is required before existing blocks change.");

  return {
    baseY: minElevation,
    slope,
    excavationBlocks: excavation,
    foundationBlocks: Math.max(0, origin.y - minElevation) * width * depth,
    water,
    lava,
    trees,
    occupied,
    unloaded,
    protectedBlocks: protectedBlocks.slice(0, 40),
    protectedCount: protectedBlocks.length,
    warnings,
    footprint: { width, depth, height },
    requiresApproval: occupied > 0 || protectedBlocks.length > 0 || lava > 0 || unloaded > 0,
  };
}
