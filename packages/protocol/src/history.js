import { matchesBlock } from "./block-state.js";
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
    const sample = currentAt(change);
    const current = String(typeof sample === "string" ? sample : sample?.name || "air").replace(
      /^minecraft:/,
      "",
    );
    const after = String(change.after).replace(/^minecraft:/, "");
    const before = String(change.before).replace(/^minecraft:/, "");
    if (
      current !== after ||
      (Object.keys(change.afterStates || {}).length &&
        !matchesBlock(sample, { block: after, states: change.afterStates }))
    ) {
      conflicts.push({ ...change, current });
      continue;
    }
    if (
      current === before &&
      (!Object.keys(change.beforeStates || {}).length ||
        matchesBlock(sample, { block: before, states: change.beforeStates }))
    )
      continue;
    operations.push({
      x: change.x,
      y: change.y,
      z: change.z,
      block: before || "air",
      ...(change.beforeStates ? { states: change.beforeStates } : {}),
    });
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
    beforeStates: change.afterStates,
    afterStates: change.beforeStates,
  }));
  const result = planUndo(flipped, currentAt);
  return { ...result, operations: result.operations };
}

export function emptyHistoryReason() {
  return "No build history is available to undo.";
}

void RESTORABLE;
