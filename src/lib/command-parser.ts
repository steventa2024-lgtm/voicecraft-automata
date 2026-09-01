/**
 * Speech → structured build instruction.
 * Shared by the web dashboard and the local bridge (bridge/parser.js mirrors this).
 */

export type StructureKind =
  | "mansion"
  | "house"
  | "tower"
  | "castle"
  | "bridge"
  | "wall"
  | "pyramid"
  | "farm"
  | "garden"
  | "fountain"
  | "unknown";

export interface BuildInstruction {
  action: "build" | "clear" | "stop" | "unknown";
  structure: StructureKind;
  material: string;
  size: "small" | "medium" | "large";
  dimensions: { width: number; depth: number; height: number };
  floors: number;
  offset: { x: number; y: number; z: number };
  confidence: number;
  raw: string;
}

const STRUCTURES: Array<[StructureKind, string[]]> = [
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

const MATERIALS: Array<[string, string[]]> = [
  ["stone_bricks", ["stone brick", "stone bricks", "stone"]],
  ["oak_planks", ["oak", "wood", "wooden", "plank"]],
  ["quartz_block", ["quartz", "white", "marble"]],
  ["deepslate_tiles", ["deepslate", "dark", "obsidian"]],
  ["sandstone", ["sandstone", "sand", "desert"]],
  ["bricks", ["brick", "red brick"]],
  ["glass", ["glass", "modern"]],
];

const BASE_SIZE: Record<StructureKind, [number, number, number, number]> = {
  // width, depth, height-per-floor, floors
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

const SIZE_SCALE = { small: 0.65, medium: 1, large: 1.5 } as const;

function findKind(text: string): { kind: StructureKind; hit: boolean } {
  for (const [kind, words] of STRUCTURES) {
    if (words.some((w) => text.includes(w))) return { kind, hit: true };
  }
  return { kind: "unknown", hit: false };
}

export function parseCommand(input: string): BuildInstruction {
  const raw = input.trim();
  const text = raw.toLowerCase();

  let action: BuildInstruction["action"] = "unknown";
  if (/\b(stop|cancel|abort|halt)\b/.test(text)) action = "stop";
  else if (/\b(clear|remove|demolish|flatten|delete)\b/.test(text)) action = "clear";
  else if (/\b(build|make|create|construct|place|erect|spawn)\b/.test(text)) action = "build";

  const { kind, hit } = findKind(text);
  if (action === "unknown" && hit) action = "build";

  const material =
    MATERIALS.find(([, words]) => words.some((w) => text.includes(w)))?.[0] ??
    (kind === "castle" || kind === "tower" ? "stone_bricks" : "oak_planks");

  const size: BuildInstruction["size"] = /\b(huge|giant|massive|large|big|epic)\b/.test(text)
    ? "large"
    : /\b(tiny|small|little|compact|mini)\b/.test(text)
      ? "small"
      : "medium";

  const [bw, bd, bh, bf] = BASE_SIZE[kind];
  const scale = SIZE_SCALE[size];
  const odd = (n: number) => {
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

export function describeInstruction(i: BuildInstruction): string {
  if (i.action === "stop") return "Abort active build queue";
  if (i.action === "clear")
    return `Clear ${i.dimensions.width}×${i.dimensions.depth} area in front of the bot`;
  if (i.action === "unknown" || i.structure === "unknown")
    return "No recognised structure — try “build me a stone mansion”";
  return `${i.structure} · ${i.dimensions.width}×${i.dimensions.depth}×${i.dimensions.height} · ${i.material.replace(/_/g, " ")} · ${i.floors} floor${i.floors > 1 ? "s" : ""}`;
}

export function estimateBlocks(i: BuildInstruction): number {
  const { width, depth, height } = i.dimensions;
  if (i.structure === "pyramid") return Math.round((width * depth * height) / 3);
  if (i.structure === "wall") return width * height;
  if (i.structure === "farm") return width * depth * 2;
  if (i.structure === "garden") return Math.round(width * depth * 1.6);
  if (i.structure === "fountain") return Math.round(width * depth * 1.8);
  const shell = 2 * (width + depth) * height + width * depth * (i.floors + 1);
  return Math.round(shell);
}
