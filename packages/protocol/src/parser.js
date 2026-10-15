import {
  ACTIONS,
  COMMAND_VERSION,
  DEFAULT_CLEAR,
  MATERIALS,
  MAX_DEPTH,
  MAX_DISTANCE,
  MAX_FLOORS,
  MAX_HEIGHT,
  MAX_OPERATIONS,
  MAX_RAW_LENGTH,
  MAX_VERTICAL,
  MAX_WIDTH,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
} from "./limits.js";

const STRUCTURE_PHRASES = [
  ["mansion", ["mansion", "manor", "estate"]],
  ["fortress", ["fortress", "stronghold", "bastion", "citadel"]],
  ["castle", ["castle", "keep", "palace"]],
  ["watchtower", ["watchtower", "watch tower", "lookout", "guard tower", "beacon tower"]],
  ["tower", ["tower", "spire", "lighthouse"]],
  ["bridge", ["bridge", "walkway"]],
  ["wall", ["wall", "perimeter", "fence"]],
  ["pyramid", ["pyramid", "tomb"]],
  ["farm", ["farm", "field", "crops"]],
  ["garden", ["flower garden", "garden", "park", "orchard"]],
  ["fountain", ["fountain", "pond", "water feature"]],
  ["house", ["house", "hut", "cabin", "cottage", "home", "shack"]],
];

/** Longer and more specific phrases win. "stone" must not consume "sandstone" or "stone bricks". */
const MATERIAL_PHRASES = [
  ["sandstone", "sandstone"],
  ["deepslate_tiles", "deepslate tiles"],
  ["deepslate_tiles", "deepslate"],
  ["deepslate_tiles", "blackstone"],
  ["quartz_block", "quartz"],
  ["quartz_block", "marble"],
  ["stone_bricks", "stone bricks"],
  ["stone_bricks", "stone brick"],
  ["bricks", "red bricks"],
  ["bricks", "red brick"],
  ["bricks", "bricks"],
  ["bricks", "brick"],
  ["glass", "glass"],
  ["oak_planks", "oak planks"],
  ["oak_planks", "oak"],
  ["oak_planks", "wooden"],
  ["oak_planks", "wood"],
  ["stone", "stone"],
];

const BASE_SIZE = {
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
};

const SIZE_SCALE = { small: 0.65, medium: 1, large: 1.5 };
const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const STONE_FAMILY = new Set(["castle", "tower", "fortress", "watchtower", "pyramid"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(text, phrase) {
  const pattern = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`, "i").test(text);
}

function findKind(text) {
  for (const [kind, words] of STRUCTURE_PHRASES) {
    if (words.some((word) => hasPhrase(text, word))) return kind;
  }
  return "unknown";
}

function findMaterial(text) {
  for (const [material, phrase] of MATERIAL_PHRASES) {
    if (hasPhrase(text, phrase)) return material === "stone" ? "stone_bricks" : material;
  }
  return null;
}

function parseDirection(text) {
  if (/\b(behind(?: me)?|back of me|backward|backwards)\b/.test(text)) return "back";
  if (/\b((?:to|on) (?:my|the) left|left of me)\b/.test(text)) return "left";
  if (/\b((?:to|on) (?:my|the) right|right of me)\b/.test(text)) return "right";
  return "front";
}

function parseAction(text) {
  if (/\b(stop|cancel|abort|halt)\b/.test(text)) return "stop";
  if (/\b(pause|hold)\b/.test(text)) return "pause";
  if (/\b(resume|continue)\b/.test(text)) return "resume";
  if (/\b(redo|rebuild last)\b/.test(text)) return "redo";
  if (/\b(undo|revert|restore)\b/.test(text)) return "undo";
  if (/\b(inspect|survey|scan)\b/.test(text)) return "inspect";
  if (/\b(preview|show me)\b/.test(text)) return "preview";
  if (/\b(clear|remove|demolish|flatten|delete)\b/.test(text)) return "clear";
  if (/\b(build|make|create|construct|place|erect|spawn)\b/.test(text)) return "build";
  return "unknown";
}

function parsePosition(text, errors) {
  const labeled = text.match(
    /\b(?:at|coordinates?)\s+x\s*[:=]?\s*(-?\d{1,8})\s*,?\s*y\s*[:=]?\s*(-?\d{1,4})\s*,?\s*z\s*[:=]?\s*(-?\d{1,8})\b/,
  );
  const bare = text.match(/\bat\s+(-?\d{1,8})\s+(-?\d{1,4})\s+(-?\d{1,8})\b/);
  const match = labeled || bare;
  if (!match) return null;
  const position = { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
  if (position.y < WORLD_MIN_Y || position.y > WORLD_MAX_Y) {
    errors.push(`Y coordinate ${position.y} is outside the world height ${WORLD_MIN_Y}..${WORLD_MAX_Y}.`);
  }
  return position;
}

function boundDimension(value, max, label, errors) {
  if (!Number.isFinite(value) || value < 1) {
    errors.push(`${label} is invalid.`);
    return null;
  }
  if (value > max) {
    errors.push(`${label} ${value} exceeds the safe limit of ${max}.`);
    return null;
  }
  return Math.round(value);
}

function estimateOperations(action, structure, dimensions) {
  const { width, depth, height } = dimensions;
  if (action === "stop" || action === "pause" || action === "resume" || action === "undo" || action === "redo") {
    return 0;
  }
  if (action === "clear") return width * depth * height;
  if (structure === "pyramid") return Math.round((width * depth * Math.ceil(width / 2)) / 3);
  if (structure === "wall") return width * height;
  if (structure === "farm" || structure === "garden") return width * depth * 2;
  if (structure === "fountain") return Math.round(width * width * 2);
  if (structure === "unknown") return 0;
  return 2 * (width + depth) * height + width * depth * 2;
}

function emptyInstruction(raw, errors) {
  return {
    version: COMMAND_VERSION,
    action: "unknown",
    structure: "unknown",
    material: "oak_planks",
    size: "medium",
    direction: "front",
    dimensions: { width: 0, depth: 0, height: 0 },
    floors: 1,
    offset: { x: 0, y: 0, z: 6 },
    position: null,
    rotation: 0,
    confidence: 0,
    raw,
    requiresConfirmation: false,
    protectedBlockPolicy: "abort",
    estimatedOperations: 0,
    clamped: false,
    warnings: [],
    valid: false,
    errors,
    approved: false,
  };
}

/**
 * Parse a spoken or typed instruction into the shared command contract.
 * Oversized explicit values are rejected rather than silently clamped.
 * `approved` is always false — approval is a separate authorized action.
 */
export function parseCommand(input) {
  const original = String(input ?? "");
  const raw = original.trim();
  const errors = [];
  const warnings = [];

  if (raw.length > MAX_RAW_LENGTH) {
    return emptyInstruction(raw.slice(0, MAX_RAW_LENGTH), [
      `Instruction exceeds ${MAX_RAW_LENGTH} characters.`,
    ]);
  }
  if (!raw) {
    return emptyInstruction("", ["Instruction is empty."]);
  }

  const text = raw.toLowerCase();
  let action = parseAction(text);
  const structure = findKind(text);
  if (action === "unknown" && structure !== "unknown") action = "build";

  const explicitMaterial = findMaterial(text);
  const material =
    explicitMaterial ||
    (STONE_FAMILY.has(structure) ? "stone_bricks" : "oak_planks");

  const size = /\b(huge|giant|massive|large|big|epic)\b/.test(text)
    ? "large"
    : /\b(tiny|small|little|compact|mini)\b/.test(text)
      ? "small"
      : "medium";

  const base = BASE_SIZE[structure] || [9, 7, 4, 1];
  const scale = SIZE_SCALE[size];
  const floorNumeric = text.match(/\b(\d{1,2})\s*(?:floors?|stor(?:ey|y|ies))\b/);
  const floorWord = text.match(
    new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\s*(?:floors?|stor(?:ey|y|ies))\\b`),
  );
  let floors = base[3];
  if (floorNumeric) floors = Number(floorNumeric[1]);
  else if (floorWord) floors = NUMBER_WORDS[floorWord[1]];
  if (floors > MAX_FLOORS) {
    errors.push(`Floor count ${floors} exceeds the safe limit of ${MAX_FLOORS}.`);
    floors = MAX_FLOORS;
  }
  if (floors < 1) floors = 1;

  let width = Math.max(3, Math.round(base[0] * scale));
  let depth = Math.max(3, Math.round(base[1] * scale));
  let height = Math.max(3, Math.round(base[2] * (structure === "pyramid" ? scale : 1)) * (structure === "pyramid" ? 1 : floors));

  const dimensionsMatch = text.match(
    /\b(\d{1,4})\s*(?:x|×|by)\s*(\d{1,4})(?:\s*(?:x|×|by)\s*(\d{1,4}))?\b/,
  );
  let explicitDimensions = false;
  if (dimensionsMatch) {
    explicitDimensions = true;
    width = Number(dimensionsMatch[1]);
    depth = Number(dimensionsMatch[2]);
    if (dimensionsMatch[3]) height = Number(dimensionsMatch[3]);
  }
  const wideMatch = text.match(/\b(\d{1,4})\s*blocks?\s+wide\b/);
  const deepMatch = text.match(/\b(\d{1,4})\s*blocks?\s+(?:deep|long)\b/);
  const tallMatch = text.match(/\b(\d{1,4})\s*blocks?\s+tall\b/);
  if (wideMatch) {
    explicitDimensions = true;
    width = Number(wideMatch[1]);
  }
  if (deepMatch) {
    explicitDimensions = true;
    depth = Number(deepMatch[1]);
  }
  if (tallMatch) {
    explicitDimensions = true;
    height = Number(tallMatch[1]);
  }

  if (action === "clear" && !explicitDimensions && structure === "unknown") {
    width = DEFAULT_CLEAR.width;
    depth = DEFAULT_CLEAR.depth;
    height = DEFAULT_CLEAR.height;
    warnings.push("Clear area defaulted to a 15×15×8 footprint. Confirm before anything is removed.");
  }

  const checkedWidth = boundDimension(width, action === "wall" ? MAX_WIDTH : MAX_WIDTH, "Width", errors);
  const checkedDepth = boundDimension(depth, MAX_DEPTH, "Depth", errors);
  const checkedHeight = boundDimension(height, MAX_HEIGHT, "Height", errors);
  if (checkedWidth) width = checkedWidth;
  if (checkedDepth) depth = checkedDepth;
  if (checkedHeight) height = checkedHeight;

  const distanceMatch = text.match(/\b(\d{1,4})\s*blocks?\s*(?:away|ahead|in front|behind|forward)\b/);
  let distance = 6;
  if (distanceMatch) {
    distance = Number(distanceMatch[1]);
    if (distance > MAX_DISTANCE) {
      errors.push(`Distance ${distance} exceeds the safe limit of ${MAX_DISTANCE}.`);
    } else if (distance < 2) {
      errors.push("Distance must be at least 2 blocks so the build does not intersect the bot.");
    }
  }
  const verticalMatch = text.match(/\b(\d{1,3})\s*blocks?\s*(above|up|below|down)\b/);
  let vertical = 0;
  if (verticalMatch) {
    const magnitude = Number(verticalMatch[1]);
    if (magnitude > MAX_VERTICAL) errors.push(`Vertical offset ${magnitude} exceeds ${MAX_VERTICAL}.`);
    vertical = /below|down/.test(verticalMatch[2]) ? -magnitude : magnitude;
  }

  const position = parsePosition(text, errors);
  const direction = parseDirection(text);
  const destructive = action === "build" || action === "clear" || action === "undo" || action === "redo";
  const requiresConfirmation = destructive;

  if (action === "build" && structure === "unknown") {
    errors.push("No recognised structure. Name a house, tower, castle, or another supported build.");
  }
  if (action === "unknown") {
    errors.push("No recognised instruction. Try “preview a stone mansion” or type a command.");
  }
  if (!ACTIONS.includes(action)) errors.push("Unsupported action.");
  if (explicitMaterial === null && action === "build") {
    warnings.push(`Material defaulted to ${material.replaceAll("_", " ")}.`);
  }

  const dimensions = {
    width: checkedWidth || 0,
    depth: checkedDepth || 0,
    height: checkedHeight || 0,
  };
  const estimatedOperations = estimateOperations(action, structure, dimensions);
  if (estimatedOperations > MAX_OPERATIONS) {
    errors.push(`Estimated ${estimatedOperations} operations exceeds the cap of ${MAX_OPERATIONS}.`);
  }

  const confidenceBase =
    (action !== "unknown" ? 0.45 : 0.1) +
    (structure !== "unknown" || ["clear", "undo", "redo", "stop", "pause", "resume", "inspect"].includes(action)
      ? 0.35
      : 0) +
    (explicitDimensions || floorNumeric || floorWord ? 0.1 : 0.04) +
    (explicitMaterial ? 0.05 : 0);
  const confidence = Number(Math.max(0, Math.min(0.99, confidenceBase - errors.length * 0.2)).toFixed(2));

  return {
    version: COMMAND_VERSION,
    action,
    structure,
    material: MATERIALS.includes(material) ? material : "oak_planks",
    size,
    direction,
    dimensions,
    floors: Math.min(floors, MAX_FLOORS),
    offset: { x: 0, y: vertical, z: Math.min(distance, MAX_DISTANCE) },
    position,
    rotation: 0,
    confidence,
    raw,
    requiresConfirmation,
    protectedBlockPolicy: "abort",
    estimatedOperations,
    clamped: false,
    warnings,
    valid: errors.length === 0,
    errors,
    approved: false,
  };
}

export function describeInstruction(instruction) {
  if (!instruction) return "No instruction";
  if (instruction.action === "stop") return "Stop the active build";
  if (instruction.action === "pause") return "Pause the active build";
  if (instruction.action === "resume") return "Resume the paused build";
  if (instruction.action === "undo") return "Undo the last supported build where blocks are unchanged";
  if (instruction.action === "redo") return "Redo the last undone build where the world still matches";
  if (instruction.action === "inspect") return "Survey the target area without changing blocks";
  if (instruction.action === "clear") {
    return `Clear ${instruction.dimensions.width}×${instruction.dimensions.depth}×${instruction.dimensions.height} ${instruction.direction} (confirmation required)`;
  }
  if (instruction.action === "unknown" || !instruction.valid) {
    return instruction.errors?.[0] || "Unrecognised instruction";
  }
  const verb = instruction.action === "preview" ? "Preview" : "Build";
  const where = instruction.position
    ? `at ${instruction.position.x}, ${instruction.position.y}, ${instruction.position.z}`
    : `${instruction.offset.z} blocks ${instruction.direction}`;
  return `${verb} ${instruction.structure} · ${instruction.dimensions.width}×${instruction.dimensions.depth}×${instruction.dimensions.height} · ${instruction.material.replaceAll("_", " ")} · ${instruction.floors} floor${instruction.floors === 1 ? "" : "s"} · ${where}`;
}

export function estimateBlocks(instruction) {
  if (!instruction?.valid) return 0;
  return instruction.estimatedOperations || 0;
}

export function isDestructiveAction(action) {
  return action === "build" || action === "clear" || action === "undo" || action === "redo";
}
