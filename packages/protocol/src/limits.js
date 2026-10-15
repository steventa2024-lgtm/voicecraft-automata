/** Hard safety bounds shared by the parser, planner, and bridge. */
export const COMMAND_VERSION = 2;
export const PROTOCOL_VERSION = 1;

export const MAX_RAW_LENGTH = 500;
export const MAX_MESSAGE_BYTES = 256 * 1024;
export const MAX_WIDTH = 64;
export const MAX_DEPTH = 64;
export const MAX_HEIGHT = 96;
export const MAX_FLOORS = 8;
export const MAX_DISTANCE = 48;
export const MAX_VERTICAL = 32;
export const MAX_OPERATIONS = 120_000;
export const MAX_COORDINATE = 30_000_000;
export const WORLD_MIN_Y = -64;
export const WORLD_MAX_Y = 319;
export const DEFAULT_CLEAR = { width: 15, depth: 15, height: 8 };
export const MAX_HISTORY_BUILDS = 30;
export const MAX_HISTORY_BLOCKS = 50_000;
export const MAX_BLUEPRINTS = 200;

export const STRUCTURES = [
  "mansion",
  "fortress",
  "castle",
  "watchtower",
  "tower",
  "bridge",
  "wall",
  "pyramid",
  "farm",
  "garden",
  "fountain",
  "house",
];

export const MATERIALS = [
  "stone_bricks",
  "oak_planks",
  "quartz_block",
  "deepslate_tiles",
  "sandstone",
  "bricks",
  "glass",
  "stone",
];

export const ACTIONS = [
  "build",
  "preview",
  "inspect",
  "clear",
  "undo",
  "redo",
  "stop",
  "pause",
  "resume",
  "unknown",
];

export const PROTECTED_BLOCKS = [
  "chest",
  "trapped_chest",
  "barrel",
  "shulker_box",
  "hopper",
  "dropper",
  "dispenser",
  "furnace",
  "blast_furnace",
  "smoker",
  "brewing_stand",
  "enchanting_table",
  "beacon",
  "spawner",
  "ender_chest",
  "lectern",
  "jukebox",
  "respawn_anchor",
];

export const CONTAINER_BLOCKS = new Set(PROTECTED_BLOCKS);

export function isProtectedBlock(name) {
  const base = String(name || "").replace(/^minecraft:/, "");
  if (PROTECTED_BLOCKS.includes(base)) return true;
  return base.endsWith("shulker_box");
}
