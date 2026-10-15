import { isProtectedBlock } from "./limits.js";

const RESTORABLE = new Set(["air", "cave_air", "void_air"]);

export function canRestoreBlock(name) {
  return !isProtectedBlock(name);
}

/**
 * Undo only positions whose current block still equals the recorded replacement.
 * Containers and other protected blocks are excluded from automatic rollback.
 */
export function planUndo(changes, currentAt) {
  const operations = [];
  const conflicts = [];
  const excluded = [];
  for (const change of changes) {
    if (!canRestoreBlock(change.before) || !canRestoreBlock(change.after)) {
      excluded.push(change);
      continue;
    }
    const current = String(currentAt(change) || "air").replace(/^minecraft:/, "");
    const after = String(change.after).replace(/^minecraft:/, "");
    const before = String(change.before).replace(/^minecraft:/, "");
    if (current !== after) {
      conflicts.push({ ...change, current });
      continue;
    }
    if (current === before) continue;
    operations.push({ x: change.x, y: change.y, z: change.z, block: before || "air" });
  }
  return {
    operations,
    conflicts,
    excluded,
    available: operations.length > 0,
    reason:
      operations.length > 0
        ? null
        : excluded.length > 0 && conflicts.length === 0
          ? "Undo is unavailable because the build only changed protected block-entity state."
          : "Undo is unavailable because the world no longer matches the recorded build.",
  };
}

export function planRedo(changes, currentAt) {
  const flipped = changes.map((change) => ({
    ...change,
    before: change.after,
    after: change.before,
  }));
  const result = planUndo(flipped, currentAt);
  return { ...result, operations: result.operations };
}

export function emptyHistoryReason() {
  return "No build history is available to undo.";
}

void RESTORABLE;
