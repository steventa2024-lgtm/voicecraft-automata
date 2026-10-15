const TRANSITIONS = {
  idle: ["planning"],
  planning: ["awaiting_approval", "failed", "idle"],
  awaiting_approval: ["building", "cancelled", "failed"],
  building: ["paused", "cancelling", "completed", "failed"],
  paused: ["building", "cancelling"],
  cancelling: ["cancelled", "failed"],
  cancelled: ["idle", "planning"],
  completed: ["idle", "planning"],
  failed: ["idle", "planning"],
};

export const BUILD_STATES = Object.keys(TRANSITIONS);

export function transition(state, next) {
  const allowed = TRANSITIONS[state];
  if (!allowed || !allowed.includes(next)) {
    return { ok: false, state, error: `Cannot move from ${state} to ${next}.` };
  }
  return { ok: true, state: next };
}

export function isTerminal(state) {
  return state === "cancelled" || state === "completed" || state === "failed";
}

/** A cancelled job is never reported as completed. */
export function finalStatus({ cancelled, failed, placed, requested }) {
  if (cancelled) return "cancelled";
  if (failed > 0 || (requested > 0 && placed < requested)) return failed > 0 && placed > 0 ? "completed_with_errors" : "failed";
  if (placed === requested && requested > 0) return "completed";
  return "failed";
}
