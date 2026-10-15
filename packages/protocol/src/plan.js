import { canonicalStates } from "./block-state.js";
import { planFingerprint } from "./blueprint-edit.js";
import { generateStructure } from "./generators.js";
import { generateTemplate } from "./templates.js";
import { isProtectedBlock, MAX_OPERATIONS } from "./limits.js";
import { worldBoundsError } from "./coordinates.js";

/** Drop container writes and writes onto containers. The caller must not place the skipped cells. */
export function partitionProtectedTargets(blocks, sample) {
  const place = [];
  const skipped = [];
  for (const block of blocks) {
    if (isProtectedBlock(block.block)) {
      skipped.push(block);
      continue;
    }
    const existing = sample?.(block);
    if (existing && isProtectedBlock(existing)) {
      skipped.push(block);
      continue;
    }
    place.push(block);
  }
  return { place, skipped };
}

function dedupe(blocks) {
  const map = new Map();
  for (const block of blocks) {
    if (
      !block ||
      !Number.isFinite(block.x) ||
      !Number.isFinite(block.y) ||
      !Number.isFinite(block.z)
    )
      continue;
    if (typeof block.block !== "string" || !/^[a-z0-9_]+$/.test(block.block)) continue;
    map.set(`${block.x}|${block.y}|${block.z}`, {
      x: block.x | 0,
      y: block.y | 0,
      z: block.z | 0,
      block: block.block,
      ...(block.states ? { states: canonicalStates(block.block, block.states) } : {}),
    });
  }
  return [...map.values()];
}

export function planClear(instruction) {
  const { width, depth, height } = instruction.dimensions;
  const volume = width * depth * height;
  if (volume > MAX_OPERATIONS) {
    const error = new Error(`Clear volume ${volume} exceeds ${MAX_OPERATIONS} operations.`);
    error.code = "operation_cap";
    throw error;
  }
  const blocks = [];
  for (let y = 0; y < height; y += 1) {
    for (let z = 0; z < depth; z += 1) {
      for (let x = 0; x < width; x += 1) {
        blocks.push({ x, y, z, block: "air" });
      }
    }
  }
  return blocks;
}

export function buildPlan(instruction) {
  if (!instruction?.valid) {
    const error = new Error(instruction?.errors?.[0] || "Instruction is not valid.");
    error.code = "invalid_instruction";
    throw error;
  }
  let warnings = [];
  const blocks = dedupe(
    instruction.templateId
      ? (() => {
          const generated = generateTemplate(
            instruction.templateId,
            instruction.templateOptions || {},
          );
          warnings = generated.warnings;
          return generated.blocks;
        })()
      : instruction.action === "clear"
        ? planClear(instruction)
        : generateStructure(instruction),
  );
  const protectedWrite = blocks.find((block) => isProtectedBlock(block.block));
  if (protectedWrite) {
    const error = new Error(
      `The plan places ${protectedWrite.block}, which is protected. Remove it and generate the preview again.`,
    );
    error.code = "protected_write";
    throw error;
  }
  if (blocks.length > MAX_OPERATIONS) {
    const error = new Error(
      `Plan has ${blocks.length} operations, above the cap of ${MAX_OPERATIONS}.`,
    );
    error.code = "operation_cap";
    throw error;
  }
  if (blocks.length === 0) {
    const error = new Error("The generator produced an empty plan.");
    error.code = "empty_plan";
    throw error;
  }
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const materials = new Set();
  for (const block of blocks) {
    minX = Math.min(minX, block.x);
    minY = Math.min(minY, block.y);
    minZ = Math.min(minZ, block.z);
    maxX = Math.max(maxX, block.x);
    maxY = Math.max(maxY, block.y);
    maxZ = Math.max(maxZ, block.z);
    if (block.block !== "air") materials.add(block.block);
  }
  return {
    blocks,
    count: blocks.length,
    bounds: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      depth: maxZ - minZ + 1,
    },
    materials: [...materials],
    airCount: blocks.filter((block) => block.block === "air").length,
    fingerprint: planFingerprint(blocks),
    templateId: instruction.templateId || null,
    warnings,
  };
}

export function assertPlanFitsWorld(originY, plan) {
  const message = worldBoundsError(originY + (plan.bounds.min?.y || 0), plan.bounds.height);
  if (message) {
    const error = new Error(message);
    error.code = "world_bounds";
    throw error;
  }
}
