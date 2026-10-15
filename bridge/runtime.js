import { randomUUID } from "node:crypto";
import {
  assessPayload,
  buildPlan,
  decideDispatch,
  executeDispatch,
  isLoopbackAddress,
  parseCommand,
  placementOrigin,
  sanitizeInstruction,
  surveyTerrain,
  timingSafeStringEqual,
  transition,
  worldBoundsError,
} from "../packages/protocol/src/index.js";

const AUTH_TIMEOUT_MS = 5_000;

export function createBridgeRuntime(options) {
  const pending = new Map();
  let state = "idle";
  let activeJob = null;

  function emit(event) {
    options.onEvent?.(event);
  }

  function setState(next) {
    const result = transition(state, next);
    if (!result.ok) return false;
    state = result.state;
    emit({ type: "state", state });
    return true;
  }

  async function previewInstruction(instruction, jobId) {
    if (state === "idle" || state === "completed" || state === "failed" || state === "cancelled") {
      setState("planning");
    }
    const plan = buildPlan(instruction.action === "clear" ? instruction : { ...instruction, action: instruction.action === "preview" || instruction.action === "inspect" ? "build" : instruction.action, valid: instruction.structure !== "unknown" });
    const player = options.getPlayer?.() || { x: 0, y: 64, z: 0, yaw: 0 };
    const origin = placementOrigin({
      player,
      yaw: player.yaw || 0,
      instruction: instruction.action === "clear" ? instruction : { ...instruction, action: "build" },
    });
    const boundsError = worldBoundsError(origin.y, plan.bounds.height);
    const site = options.sampleBlock
      ? surveyTerrain({
          origin,
          width: origin.footprint.width,
          depth: origin.footprint.depth,
          height: plan.bounds.height,
          sampler: options.sampleBlock,
          protectedExtra: options.protectedBlocks || [],
        })
      : null;
    const id = jobId || randomUUID();
    pending.set(id, { instruction, plan, origin, site, createdAt: Date.now() });
    if (state === "planning") setState("awaiting_approval");
    emit({
      type: "plan",
      jobId: id,
      instruction,
      count: plan.count,
      bounds: plan.bounds,
      materials: plan.materials,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      site,
      warnings: [...(instruction.warnings || []), ...(site?.warnings || []), ...(boundsError ? [boundsError] : [])],
      executable: !boundsError && instruction.valid,
    });
    return { jobId: id, plan, origin, site, boundsError };
  }

  async function runApproved(jobId, runnerToken) {
    const job = pending.get(jobId);
    if (!job) {
      emit({ type: "error", message: "There is no pending build to approve." });
      return { ok: false };
    }
    if (job.boundsError || worldBoundsError(job.origin.y, job.plan.bounds.height)) {
      emit({ type: "error", message: "The plan does not fit inside the world height." });
      return { ok: false };
    }
    if (job.site?.protectedCount > 0 && job.instruction.protectedBlockPolicy !== "skip") {
      emit({
        type: "error",
        message: "Protected blocks are inside the footprint. Change the site or explicitly choose skip policy.",
      });
      return { ok: false };
    }
    const decision = await options.authorize?.({
      requestedBlocks: job.plan.count,
      runnerToken,
      jobId,
      action: job.instruction.action === "preview" ? "build" : job.instruction.action,
    });
    if (!decision?.allowed) {
      emit({
        type: "error",
        message: decision?.message || "Build authorization was refused. Sign in and check the subscription allowance.",
      });
      return { ok: false };
    }
    if (activeJob && !activeJob.done) {
      emit({ type: "error", message: "A build is already running." });
      return { ok: false };
    }
    const controller = { cancelled: false, paused: false, done: false, placed: 0 };
    activeJob = controller;
    setState("building");
    emit({ type: "status", status: "building", jobId, message: "Build started", progress: 0 });
    try {
      const result = await options.place({
        instruction: { ...job.instruction, approved: true, action: job.instruction.action === "preview" ? "build" : job.instruction.action },
        plan: job.plan,
        origin: job.origin,
        job: controller,
        onProgress: (progress) => {
          controller.placed = progress.placed;
          emit({ type: "progress", jobId, ...progress, progress: progress.progress });
        },
      });
      controller.done = true;
      const finalState = controller.cancelled ? "cancelled" : result.status === "failed" ? "failed" : "completed";
      if (controller.cancelled) setState("cancelling");
      setState(finalState === "cancelled" ? "cancelled" : finalState === "failed" ? "failed" : "completed");
      if ((result.placed || 0) === 0) await options.release?.({ requestedBlocks: job.plan.count, runnerToken, jobId });
      pending.delete(jobId);
      emit({
        type: "status",
        status: controller.cancelled ? "cancelled" : result.status,
        jobId,
        message: controller.cancelled ? "Build cancelled" : `Build ${result.status.replaceAll("_", " ")}`,
        result,
      });
      return { ok: !controller.cancelled && result.failed === 0, result };
    } catch (error) {
      controller.done = true;
      if (state === "building" || state === "paused" || state === "cancelling") setState("failed");
      if ((controller.placed || 0) === 0) await options.release?.({ requestedBlocks: job.plan.count, runnerToken, jobId });
      emit({ type: "error", message: error.message || "Build failed." });
      return { ok: false };
    }
  }

  return {
    get state() {
      return state;
    },
    get activeJob() {
      return activeJob;
    },
    authenticate(token) {
      return timingSafeStringEqual(token, options.authToken);
    },
    acceptConnection(remoteAddress, origin) {
      if (!isLoopbackAddress(remoteAddress) && !options.allowLan) {
        return { ok: false, reason: "Bridge refuses non-loopback clients." };
      }
      if (origin) {
        try {
          const url = new URL(origin);
          const local = url.protocol === "file:" || (url.protocol === "http:" && isLoopbackAddress(url.hostname));
          if (!local) return { ok: false, reason: "Origin is not allowed." };
        } catch {
          return { ok: false, reason: "Origin is not allowed." };
        }
      }
      return { ok: true };
    },
    assessMessage(data) {
      return assessPayload(data, options.maxBytes);
    },
    authTimeoutMs: AUTH_TIMEOUT_MS,
    async handleMessage(client, payload) {
      if (!client.authenticated) {
        if (payload?.type !== "auth" || !this.authenticate(payload.token)) {
          emit({ type: "error", message: "Unauthenticated command rejected." });
          return { ok: false, close: true, code: "unauthorized" };
        }
        client.authenticated = true;
        emit({ type: "status", status: options.botReady ? "connected" : "idle", message: "Desktop client authorized." });
        return { ok: true };
      }
      if (payload?.type === "cancel" || payload?.type === "stop") {
        if (activeJob) activeJob.cancelled = true;
        if (state === "building" || state === "paused") setState("cancelling");
        emit({ type: "status", status: "cancelling", message: "Cancellation requested." });
        return { ok: true };
      }
      if (payload?.type === "pause") {
        if (activeJob && state === "building") {
          activeJob.paused = true;
          setState("paused");
          emit({ type: "status", status: "paused", message: "Build paused." });
        }
        return { ok: true };
      }
      if (payload?.type === "resume") {
        if (activeJob && state === "paused") {
          activeJob.paused = false;
          setState("building");
          emit({ type: "status", status: "building", message: "Build resumed." });
        }
        return { ok: true };
      }
      if (payload?.type === "approve") {
        return runApproved(payload.jobId, payload.runnerToken);
      }
      if (payload?.type === "undo" || payload?.type === "redo") {
        const decision = decideDispatch(
          { action: payload.type, valid: true, approved: true, structure: "unknown", requiresConfirmation: true },
          { authorized: true },
        );
        return executeDispatch(decision, {
          undo: () => options.undo?.(payload.runnerToken),
          redo: () => options.redo?.(payload.runnerToken),
          reject: () => ({ ok: false }),
        });
      }
      if (payload?.type !== "command") return { ok: false, code: "unsupported" };

      const instruction = payload.instruction
        ? sanitizeInstruction(payload.instruction)
        : { ok: true, instruction: parseCommand(payload.text || "") };
      if (!instruction.ok) {
        emit({ type: "error", message: instruction.errors.join(" ") });
        return { ok: false, code: "invalid" };
      }
      const decision = decideDispatch(instruction.instruction, { authorized: true });
      return executeDispatch(decision, {
        preview: () => previewInstruction({ ...instruction.instruction, action: "build", valid: true }, payload.jobId),
        inspect: () => previewInstruction(instruction.instruction, payload.jobId),
        awaiting_approval: () => previewInstruction(instruction.instruction, payload.jobId),
        build: () => ({ ok: false, code: "approval_required" }),
        clear: () => ({ ok: false, code: "approval_required" }),
        undo: () => options.undo?.(payload.runnerToken),
        redo: () => options.redo?.(payload.runnerToken),
        stop: async () => {
          if (activeJob) activeJob.cancelled = true;
          return { ok: true };
        },
        pause: async () => {
          if (activeJob) activeJob.paused = true;
          return { ok: true };
        },
        resume: async () => {
          if (activeJob) activeJob.paused = false;
          return { ok: true };
        },
        reject: () => {
          emit({ type: "error", message: instruction.instruction.errors?.[0] || "Command rejected." });
          return { ok: false, code: decision.reason };
        },
      });
    },
  };
}
