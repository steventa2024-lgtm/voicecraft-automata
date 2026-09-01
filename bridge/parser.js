/**
 * Speech → structured build instruction (JS mirror of the web app's
 * src/lib/command-parser.ts — keep the two in sync).
 */

const STRUCTURES = [
  ["mansion", ["mansion", "manor", "estate"]],
  ["castle", ["castle", "fortress", "keep"]],
  ["tower", ["tower", "spire", "lighthouse"]],
  ["bridge", ["bridge", "walkway"]],
  ["wall", ["wall", "perimeter", "fence"]],
  ["pyramid", ["pyramid", "tomb"]],
  ["farm", ["farm", "field", "crops"]],
  ["garden", ["garden", "park", "flower", "orchard"]],
  ["fountain", ["fountain", "pond", "water feature"]],
  ["house", ["house", "hut", "cabin", "cottage", "home", "shack"]],
];

const MATERIALS = [
  ["stone_bricks", ["stone brick", "stone bricks", "stone"]],
  ["oak_planks", ["oak", "wood", "wooden", "plank"]],
  ["quartz_block", ["quartz", "white", "marble"]],
  ["deepslate_tiles", ["deepslate", "dark", "obsidian"]],
  ["sandstone", ["sandstone", "sand", "desert"]],
  ["bricks", ["brick", "red brick"]],
  ["glass", ["glass", "modern"]],
];

const BASE_SIZE = {
  mansion: [21, 15, 5, 2],
  castle: [25, 25, 8, 1],
  tower: [7, 7, 4, 6],
  house: [9, 7, 4, 1],
  bridge: [25, 5, 4, 1],
  wall: [21, 1, 5, 1],
  pyramid: [21, 21, 11, 1],
  farm: [13, 13, 1, 1],
  garden: [15, 15, 2, 1],
  fountain: [11, 11, 5, 1],
  unknown: [9, 9, 4, 1],
};

const SIZE_SCALE = { small: 0.65, medium: 1, large: 1.5 };

export function parseCommand(input) {
  const raw = String(input || "").trim();
  const text = raw.toLowerCase();

  let action = "unknown";
  if (/\b(stop|cancel|abort|halt)\b/.test(text)) action = "stop";
  else if (/\b(clear|remove|demolish|flatten|delete)\b/.test(text)) action = "clear";
  else if (/\b(build|make|create|construct|place|erect|spawn)\b/.test(text)) action = "build";

  let kind = "unknown";
  let hit = false;
  for (const [k, words] of STRUCTURES) {
    if (words.some((w) => text.includes(w))) {
      kind = k;
      hit = true;
      break;
    }
  }
  if (action === "unknown" && hit) action = "build";

  const materialEntry = MATERIALS.find(([, words]) => words.some((w) => text.includes(w)));
  const material = materialEntry
    ? materialEntry[0]
    : kind === "castle" || kind === "tower"
      ? "stone_bricks"
      : "oak_planks";

  const size = /\b(huge|giant|massive|large|big|epic)\b/.test(text)
    ? "large"
    : /\b(tiny|small|little|compact|mini)\b/.test(text)
      ? "small"
      : "medium";

  const [bw, bd, bh, bf] = BASE_SIZE[kind];
  const scale = SIZE_SCALE[size];
  const odd = (n) => {
    const v = Math.max(3, Math.round(n));
    return v % 2 === 0 ? v + 1 : v;
  };

  const floorMatch = text.match(/(\d+)\s*(?:floors?|stor(?:ey|y|ies))/);
  const floors = floorMatch ? Math.min(12, Math.max(1, Number(floorMatch[1]))) : bf;

  const width = odd(bw * scale);
  const depth = odd(bd * scale);
  const height = Math.max(3, Math.round(bh * (kind === "pyramid" ? scale : 1))) * floors;

  const confidence = Math.min(
    0.99,
    (action !== "unknown" ? 0.5 : 0.15) + (hit ? 0.4 : 0) + (floorMatch ? 0.05 : 0.04),
  );

  return {
    action,
    structure: kind,
    material,
    size,
    dimensions: { width, depth, height },
    floors,
    offset: { x: 0, y: 0, z: 6 },
    confidence: Number(confidence.toFixed(2)),
    raw,
  };
}
