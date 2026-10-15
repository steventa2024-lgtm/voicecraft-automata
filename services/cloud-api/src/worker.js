import { buildPlan } from "../../../packages/protocol/src/index.js";

async function settle(job, confirmed, deps, refundBlocks) {
  if (job.reservation_kind === "remote" && job.reservation_token && deps.releaseRemote && confirmed === 0) {
    await deps.releaseRemote(job.reservation_token, refundBlocks, confirmed);
  }
}

export async function advanceJob(store, deps = {}) {
  const job = store.claimNextJob();
  if (!job) return null;
  const preview = store.previewById(job.preview_id);
  const refundBlocks = preview?.block_count || job.total_ops;
  if (store.jobById(job.id).status === "cancelling") {
    store.finishJob(job.id, {
      status: "cancelled",
      confirmed: 0,
      failed: 0,
      error: "Cancelled before placement. No blocks were placed.",
      refundBlocks,
    });
    await settle(job, 0, deps, refundBlocks);
    return store.jobById(job.id);
  }
  try {
    const reachable = deps.probe ? await deps.probe() : false;
    if (!reachable || !deps.execute) {
      store.finishJob(job.id, {
        status: "failed",
        confirmed: 0,
        failed: 0,
        error: reachable
          ? "The build executor is not attached. No blocks were placed."
          : "Minecraft host is not reachable. No blocks were placed.",
        refundBlocks,
      });
      await settle(job, 0, deps, refundBlocks);
      return store.jobById(job.id);
    }
    const instruction = JSON.parse(preview.instruction_json);
    const plan = buildPlan({ ...instruction, action: instruction.action === "clear" ? "clear" : "build", valid: true, approved: false });
    if (plan.count !== preview.block_count) {
      throw new Error("The regenerated plan does not match the approved preview.");
    }
    const result = await deps.execute({ job, plan, preview });
    const confirmed = Number(result?.confirmed || 0);
    const failed = Number(result?.failed || 0);
    if (!Number.isInteger(confirmed) || confirmed < 0 || confirmed > plan.count) {
      throw new Error("The executor returned an impossible placement count.");
    }
    const latest = store.jobById(job.id);
    const cancelled = latest.status === "cancelling";
    store.finishJob(job.id, {
      status: cancelled ? "cancelled" : failed > 0 || confirmed < plan.count ? "completed_with_errors" : "completed",
      confirmed,
      failed,
      error: result.error || null,
      refundBlocks: confirmed === 0 ? refundBlocks : 0,
    });
    await settle(job, confirmed, deps, refundBlocks);
  } catch (error) {
    store.finishJob(job.id, {
      status: "failed",
      confirmed: 0,
      failed: 0,
      error: error instanceof Error ? error.message : "The build failed before placement.",
      refundBlocks,
    });
    await settle(job, 0, deps, refundBlocks);
  }
  return store.jobById(job.id);
}
