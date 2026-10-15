/** Clears stale data on failure; request generations prevent late responses reviving a disconnected PC. */
export function createStatusMonitor(fetchStatus, publish) {
  let generation = 0;
  let lastSuccess = null;
  return {
    clear() {
      generation += 1;
      lastSuccess = null;
      publish({ data: null, error: "", checking: false, lastSuccess });
    },
    async refresh() {
      const ticket = ++generation;
      publish({ checking: true });
      try {
        const data = await fetchStatus();
        if (ticket !== generation) return;
        lastSuccess = Date.now();
        publish({ data, error: "", checking: false, lastSuccess });
        return data;
      } catch (error) {
        if (ticket !== generation) return;
        publish({
          data: null,
          error: error instanceof Error ? error.message : "Connection unavailable",
          checking: false,
          lastSuccess,
        });
      }
    },
    dispose() {
      generation += 1;
    },
  };
}
export function pcActionEnabled(action, status) {
  if (!status?.permissions?.build || !status?.bridgeRunning) return false;
  const state = status.activeJob?.status;
  if (action === "pause") return state === "building";
  if (action === "resume") return state === "paused";
  if (action === "cancel") return ["queued", "building", "paused"].includes(state);
  if (action === "undo") return ["completed", "completed_with_errors", "cancelled"].includes(state);
  return false;
}
