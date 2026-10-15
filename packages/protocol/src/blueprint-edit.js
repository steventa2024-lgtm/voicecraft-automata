import { blockKey, transformStates } from "./block-state.js";
/** Deterministic plan identity and local blueprint edits. No Minecraft I/O. */

export function planFingerprint(blocks) {
  const lines = [...blocks]
    .map((block) => `${block.x | 0},${block.y | 0},${block.z | 0},${blockKey(block)}`)
    .sort();
  let hash = 2166136261;
  const text = lines.join("\n");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function boundsOf(blocks) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const block of blocks) {
    minX = Math.min(minX, block.x);
    minY = Math.min(minY, block.y);
    minZ = Math.min(minZ, block.z);
    maxX = Math.max(maxX, block.x);
    maxY = Math.max(maxY, block.y);
    maxZ = Math.max(maxZ, block.z);
  }
  if (!Number.isFinite(minX))
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, width: 0, height: 0, depth: 0 };
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    depth: maxZ - minZ + 1,
  };
}

export function rotateBlocks(blocks, turns) {
  const steps = ((turns % 4) + 4) % 4;
  let current = blocks.map((block) => ({ ...block }));
  for (let turn = 0; turn < steps; turn += 1) {
    const box = boundsOf(current);
    current = current.map((block) => {
      const x = block.x - box.min.x;
      const z = block.z - box.min.z;
      return {
        ...block,
        ...(block.states ? { states: transformStates(block.states, (x, z) => [-z, x]) } : {}),
        x: box.min.x + (box.depth - 1 - z),
        y: block.y,
        z: box.min.z + x,
        block: block.block,
      };
    });
  }
  return current;
}

export function mirrorBlocks(blocks, axis) {
  const bounds = boundsOf(blocks);
  return blocks.map((block) => {
    if (axis === "x")
      return {
        ...block,
        ...(block.states ? { states: transformStates(block.states, (x, z) => [-x, z], true) } : {}),
        x: bounds.max.x - (block.x - bounds.min.x),
      };
    if (axis === "z")
      return {
        ...block,
        ...(block.states ? { states: transformStates(block.states, (x, z) => [x, -z], true) } : {}),
        z: bounds.max.z - (block.z - bounds.min.z),
      };
    const error = new Error("Mirror supports the x or z axis.");
    error.code = "unsupported_transform";
    throw error;
  });
}

export function replaceMaterial(blocks, from, to) {
  if (!/^[a-z0-9_]+$/.test(from) || !/^[a-z0-9_]+$/.test(to)) {
    const error = new Error("Material names must be Minecraft block ids.");
    error.code = "invalid_material";
    throw error;
  }
  return blocks.map((block) => (block.block === from ? { ...block, block: to } : block));
}

export function approvalSnapshot(plan) {
  return {
    fingerprint: plan.fingerprint || planFingerprint(plan.blocks),
    count: plan.blocks.length,
    templateId: plan.templateId || null,
  };
}

export function assertSamePlan(snapshot, blocks) {
  const fingerprint = planFingerprint(blocks);
  if (!snapshot || snapshot.fingerprint !== fingerprint || snapshot.count !== blocks.length) {
    const error = new Error(
      "The approved plan no longer matches the preview. Generate the preview again.",
    );
    error.code = "plan_mismatch";
    throw error;
  }
  return fingerprint;
}
