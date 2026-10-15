import { blockKey } from "./block-state.js";
/**
 * Placement loop used by tests and by the Mineflayer adapter.
 * placeOne returns { ok, skipped, retried }.
 */
export async function executeOperations({ operations, job, placeOne, onProgress }) {
  const total = operations.length;
  let placed = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;
  const started = Date.now();

  for (let index = 0; index < operations.length; index += 1) {
    if (job?.cancelled) break;
    while (job?.paused && !job?.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (job?.cancelled) break;
    const result = await placeOne(operations[index], index);
    if (result?.skipped) skipped += 1;
    else if (result?.ok) placed += 1;
    else failed += 1;
    retried += result?.retried || 0;
    if (onProgress && (index % 8 === 7 || index === operations.length - 1)) {
      onProgress({
        requested: total,
        placed,
        failed,
        skipped,
        retried,
        remaining: total - (placed + failed + skipped),
        elapsedMs: Date.now() - started,
      });
    }
  }

  const processed = placed + failed + skipped;
  const cancelled = Boolean(job?.cancelled) || processed < total;
  let status = "completed";
  if (cancelled && processed < total) status = "cancelled";
  else if (failed > 0 && placed > 0) status = "completed_with_errors";
  else if (failed > 0 || placed + skipped !== total) status = "failed";

  return {
    requested: total,
    placed,
    failed,
    skipped,
    retried,
    remaining: Math.max(0, total - processed),
    elapsedMs: Date.now() - started,
    status,
    progress: total === 0 ? 0 : Math.round((placed / total) * 100),
  };
}

export function chunkOperations(operations, batchSize) {
  const size = Math.max(1, batchSize | 0);
  const batches = [];
  for (let index = 0; index < operations.length; index += size) {
    batches.push(operations.slice(index, index + size));
  }
  return batches;
}

/** Vanilla /fill rejects volumes above 32,768 blocks. */
export const FILL_VOLUME_LIMIT = 32_768;

export function toFillRuns(blocks) {
  const rows = new Map();
  for (const block of blocks) {
    const key = `${block.y}|${block.z}|${blockKey(block)}`;
    const row = rows.get(key);
    if (row) row.push(block);
    else rows.set(key, [block]);
  }
  const runs = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    let start = row[0];
    let previous = row[0];
    for (let index = 1; index <= row.length; index += 1) {
      const current = row[index];
      if (current && current.x === previous.x + 1) {
        previous = current;
        continue;
      }
      const count = previous.x - start.x + 1;
      if (count > FILL_VOLUME_LIMIT) {
        throw new Error(`Fill run of ${count} exceeds the vanilla limit of ${FILL_VOLUME_LIMIT}.`);
      }
      runs.push({
        from: { x: start.x, y: start.y, z: start.z },
        to: { x: previous.x, y: previous.y, z: previous.z },
        block: start.block,
        ...(start.states ? { states: start.states } : {}),
        count,
      });
      if (!current) break;
      start = current;
      previous = current;
    }
  }
  return runs;
}

const BLOCK_ID = /^[a-z0-9_]+$/;

export function assertBlockId(name) {
  if (!BLOCK_ID.test(String(name || ""))) {
    throw new Error(`Invalid block id "${name}".`);
  }
  return `minecraft:${name}`;
}
