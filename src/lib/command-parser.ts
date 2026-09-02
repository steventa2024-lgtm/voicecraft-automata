/**
 * Speech → structured build instruction.
 * Shared by the web dashboard and the local bridge (bridge/parser.js mirrors this).
 */

export type StructureKind =
  | "mansion"
  | "house"
  | "tower"
  | "castle"
  | "fortress"
  | "watchtower"
  | "bridge"
  | "wall"
  | "pyramid"
  | "farm"
  | "garden"
  | "fountain"
  | "unknown";

export type BuildDirection = "front" | "back" | "left" | "right";

export interface BuildInstruction {
  action: "build" | "preview" | "clear" | "undo" | "stop" | "unknown";
  structure: StructureKind;
  material: string;
  size: "small" | "medium" | "large";
  direction: BuildDirection;
  dimensions: { width: number; depth: number; height: number };
  floors: number;
  offset: { x: number; y: number; z: number };
  confidence: number;
  force: boolean;
  raw: string;
}

const STRUCTURES: Array<[StructureKind, string[]]> = [
  ["mansion", ["mansion", "manor", "estate"]],
  ["fortress", ["fortress", "stronghold", "bastion", "citadel"]],
  ["castle", ["castle", "keep", "palace"]],
  ["watchtower", ["watchtower", "watch tower", "lookout", "guard tower", "beacon tower"]],
  ["tower", ["tower", "spire", "lighthouse"]],
  ["bridge", ["bridge", "walkway"]],
  ["wall", ["wall", "perimeter", "fence"]],
  ["pyramid", ["pyramid", "tomb"]],
  ["farm", ["farm", "field", "crops"]],
  ["garden", ["garden", "park", "flower garden", "orchard"]],
  ["fountain", ["fountain", "pond", "water feature"]],
  ["house", ["house", "hut", "cabin", "cottage", "home", "shack"]],
];

// Specific phrases come before broad ones so "sandstone" is never consumed
// by the generic "stone" match.
const MATERIALS: Array<[string, string[]]> = [
  ["sandstone", ["sandstone", "desert stone", "sand"]],
  ["deepslate_tiles", ["deepslate", "dark stone", "blackstone"]],
  ["quartz_block", ["quartz", "white stone", "marble"]],
  ["bricks", ["red brick", "bricks", "brick"]],
  ["oak_planks", ["oak", "wooden", "wood", "planks", "plank"]],
  ["glass", ["glass", "modern"]],
  ["stone_bricks", ["stone bricks", "stone brick", "stone"]],
];

const BASE_SIZE: Record<StructureKind, [number, number, number, number]> = {
  // width, depth, height-per-floor, floors
  mansion: [21, 15, 5, 2],
  castle: [25, 25, 8, 1],
  fortress: [31, 31, 10, 1],
  watchtower: [7, 7, 5, 4],
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hasPhrase(text: string, phrase: string): boolean {
  const pattern = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`, "i").test(text);
}

function findKind(text: string): { kind: StructureKind; hit: boolean } {
  for (const [kind, words] of STRUCTURES) {
    if (words.some((word) => hasPhrase(text, word))) return { kind, hit: true };
  }
  return { kind: "unknown", hit: false };
}

function parseDirection(text: string): BuildDirection {
  if (/\b(behind|back of me|backward|backwards)\b/.test(text)) return "back";
  if (/\b(to (?:my|the) left|on (?:my|the) left|left of me)\b/.test(text)) return "left";
  if (/\b(to (?:my|the) right|on (?:my|the) right|right of me)\b/.test(text)) return "right";
  return "front";
}

function oddDimension(value: number, max: number): number {
  const rounded = clamp(Math.round(value), 3, max);
  if (rounded % 2 === 1) return rounded;
  return rounded === max ? rounded - 1 : rounded + 1;
}

export function parseCommand(input: string): BuildInstruction {
  const raw = input.trim().slice(0, 240);
  const text = raw.toLowerCase();

  let action: BuildInstruction["action"] = "unknown";
  if (/\b(stop|cancel|abort|halt)\b/.test(text)) action = "stop";
  else if (/\b(undo|revert|restore)\b/.test(text)) action = "undo";
  else if (/\b(preview|survey|scan|inspect)\b/.test(text)) action = "preview";
  else if (/\b(clear|remove|demolish|flatten|delete)\b/.test(text)) action = "clear";
  else if (/\b(build|make|create|construct|place|erect|spawn)\b/.test(text)) action = "build";

  const { kind, hit } = findKind(text);
  if (action === "unknown" && hit) action = "build";

  const material =
    MATERIALS.find(([, words]) => words.some((word) => hasPhrase(text, word)))?.[0] ??
    (kind === "castle" || kind === "tower" || kind === "fortress" || kind === "watchtower"
      ? "stone_bricks"
      : "oak_planks");

  const size: BuildInstruction["size"] = /\b(huge|giant|massive|large|big|epic)\b/.test(text)
    ? "large"
    : /\b(tiny|small|little|compact|mini)\b/.test(text)
      ? "small"
      : "medium";

  const [bw, bd, bh, bf] = BASE_SIZE[kind];
  const scale = SIZE_SCALE[size];
  const floorMatch = text.match(/\b(\d{1,2})\s*(?:floors?|stor(?:ey|y|ies))\b/);
  const floors = floorMatch ? clamp(Number(floorMatch[1]), 1, 12) : bf;

  let width = oddDimension(bw * scale, 63);
  let depth = oddDimension(bd * scale, 63);
  let height = clamp(Math.round(bh * (kind === "pyramid" ? scale : 1)) * floors, 3, 128);

  const dimensionsMatch = text.match(
    /\b(\d{1,3})\s*(?:x|×|by)\s*(\d{1,3})(?:\s*(?:x|×|by)\s*(\d{1,3}))?\b/,
  );
  if (dimensionsMatch) {
    width = oddDimension(Number(dimensionsMatch[1]), 63);
    depth = oddDimension(Number(dimensionsMatch[2]), 63);
    if (dimensionsMatch[3]) height = clamp(Number(dimensionsMatch[3]), 3, 128);
  }

  const wideMatch = text.match(/\b(\d{1,3})\s*blocks?\s+wide\b/);
  const deepMatch = text.match(/\b(\d{1,3})\s*blocks?\s+deep\b/);
  const tallMatch = text.match(/\b(\d{1,3})\s*blocks?\s+tall\b/);
  if (wideMatch) width = oddDimension(Number(wideMatch[1]), 63);
  if (deepMatch) depth = oddDimension(Number(deepMatch[1]), 63);
  if (tallMatch) height = clamp(Number(tallMatch[1]), 3, 128);

  const distanceMatch = text.match(/\b(\d{1,2})\s*blocks?\s*(?:away|ahead|in front|behind)\b/);
  const verticalMatch = text.match(/\b(\d{1,2})\s*blocks?\s*(above|up|below|down)\b/);
  const vertical = verticalMatch
    ? clamp(Number(verticalMatch[1]), 0, 32) * (/below|down/.test(verticalMatch[2]!) ? -1 : 1)
    : 0;

  const confidence = Math.min(
    0.99,
    (action !== "unknown" ? 0.5 : 0.15) +
      (hit || ["clear", "undo", "stop"].includes(action) ? 0.4 : 0) +
      (floorMatch || dimensionsMatch ? 0.05 : 0.04),
  );

  return {
    action,
    structure: kind,
    material,
    size,
    direction: parseDirection(text),
    dimensions: { width, depth, height },
    floors,
    offset: {
      x: 0,
      y: vertical,
      z: distanceMatch ? clamp(Number(distanceMatch[1]), 3, 48) : 6,
    },
    confidence: Number(confidence.toFixed(2)),
    force: /\b(force|overwrite|ignore (?:the )?(?:warning|protection))\b/.test(text),
    raw,
  };
}

export function describeInstruction(i: BuildInstruction): string {
  if (i.action === "stop") return "Abort active build queue";
  if (i.action === "undo") return "Restore the world to before the last operation";
  if (i.action === "clear")
    return `Clear ${i.dimensions.width}×${i.dimensions.depth} area ${i.direction} of you`;
  if (i.action === "unknown" || i.structure === "unknown")
    return "No recognised structure — try “build me a stone mansion”";
  const verb = i.action === "preview" ? "Preview" : "Build";
  return `${verb} ${i.structure} · ${i.dimensions.width}×${i.dimensions.depth}×${i.dimensions.height} · ${i.material.replace(/_/g, " ")} · ${i.floors} floor${i.floors > 1 ? "s" : ""} · ${i.direction}`;
}

export function estimateBlocks(i: BuildInstruction): number {
  const { width, depth, height } = i.dimensions;
  if (i.action === "stop" || i.action === "undo" || i.action === "unknown") return 0;
  if (i.action === "clear") return width * depth * 24;
  if (i.structure === "pyramid") return Math.round((width * depth * height) / 3);
  if (i.structure === "wall") return width * height;
  if (i.structure === "farm") return width * depth * 2;
  if (i.structure === "garden") return Math.round(width * depth * 1.6);
  if (i.structure === "fountain") return Math.round(width * depth * 1.8);
  if (i.structure === "fortress") return Math.round(2 * (width + depth) * height * 1.4);
  if (i.structure === "watchtower")
    return Math.round(2 * (width + depth) * height + width * depth * 2);
  if (i.structure === "unknown") return 0;
  const shell = 2 * (width + depth) * height + width * depth * (i.floors + 1);
  return Math.round(shell);
}
