/** Mirrors verify_and_consume_builder_run without changing plan prices or limits. */
export const PLAN_LIMITS = {
  starter: { tasks: 5, blocks: 5_000 },
  builder_pro: { tasks: 30, blocks: 50_000 },
  architect: { tasks: null, blocks: 500_000 },
};

const ACTIVE = new Set(["active", "trialing"]);

export function evaluateEntitlement({ profile, usage, requestedBlocks }) {
  const tasks = usage?.task_count || 0;
  const blocks = usage?.block_count || 0;
  if (!Number.isInteger(requestedBlocks) || requestedBlocks < 1 || requestedBlocks > 1_000_000) {
    return { allowed: false, code: "invalid_block_count", message: "Invalid requested block count." };
  }
  if (!profile) {
    return { allowed: false, code: "profile_missing", message: "Account profile is not ready." };
  }
  if (profile.unlimited_tester) {
    return {
      allowed: true,
      planTier: "unlimited_tester",
      tasksRemaining: null,
      blocksRemaining: null,
      bypass: true,
    };
  }
  if (!ACTIVE.has(profile.subscription_status)) {
    return {
      allowed: false,
      code: "subscription_required",
      message: "An active ZeroPulse subscription is required.",
      planTier: profile.plan_tier,
    };
  }
  const limits = PLAN_LIMITS[profile.plan_tier];
  if (!limits) {
    return { allowed: false, code: "invalid_subscription", message: "The subscription plan is not recognized." };
  }
  const tasksRemaining = limits.tasks == null ? null : Math.max(0, limits.tasks - tasks);
  const blocksRemaining = Math.max(0, limits.blocks - blocks);
  if (limits.tasks != null && tasks + 1 > limits.tasks) {
    return {
      allowed: false,
      code: "daily_task_limit",
      message: "Daily task limit reached.",
      tasksRemaining: 0,
      blocksRemaining,
      planTier: profile.plan_tier,
    };
  }
  if (blocks + requestedBlocks > limits.blocks) {
    return {
      allowed: false,
      code: "daily_block_limit",
      message: "This build exceeds your remaining daily block allowance.",
      tasksRemaining,
      blocksRemaining,
      planTier: profile.plan_tier,
    };
  }
  return {
    allowed: true,
    planTier: profile.plan_tier,
    tasksRemaining: limits.tasks == null ? null : tasksRemaining - 1,
    blocksRemaining: blocksRemaining - requestedBlocks,
    bypass: false,
  };
}

export function applyReservation(state, requestedBlocks) {
  const decision = evaluateEntitlement({ ...state, requestedBlocks });
  if (!decision.allowed) return { state, decision };
  if (decision.bypass) return { state, decision };
  return {
    decision,
    state: {
      ...state,
      usage: {
        task_count: (state.usage?.task_count || 0) + 1,
        block_count: (state.usage?.block_count || 0) + requestedBlocks,
      },
    },
  };
}

/**
 * Accounting policy: a reservation is refunded only when no block placement was confirmed.
 * Partial builds keep the reserved task and block counts.
 */
export function releaseReservation(state, requestedBlocks, placed) {
  if (!state?.usage || placed > 0 || state.profile?.unlimited_tester) return state;
  return {
    ...state,
    usage: {
      task_count: Math.max(0, (state.usage.task_count || 0) - 1),
      block_count: Math.max(0, (state.usage.block_count || 0) - requestedBlocks),
    },
  };
}

/**
 * In-process reservation lock so two overlapping builds cannot both pass a stale read.
 * The database function remains the server-side source of truth.
 */
export function createReservationGate() {
  let tail = Promise.resolve();
  return function reserve(stateRef, requestedBlocks) {
    const run = tail.then(() => {
      const result = applyReservation(stateRef.current, requestedBlocks);
      stateRef.current = result.state;
      return result.decision;
    });
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
