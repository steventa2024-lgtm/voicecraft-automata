/** Preserve job state across progress-only bridge events. Percentages are confirmed placements. */
export function nextJobStatus(previous, event) {
  if (
    !["plan", "state", "progress", "result"].includes(event.type) &&
    !(event.type === "status" && event.jobId)
  )
    return previous;
  const result = event.result || event;
  const count = result.requested ?? event.count ?? previous?.count ?? null;
  const placed = typeof result.placed === "number" ? result.placed : null;
  const progress =
    event.type === "plan"
      ? 0
      : placed !== null && count > 0
        ? Math.round((placed / count) * 100)
        : typeof result.progress === "number"
          ? result.progress
          : (previous?.progress ?? null);
  return {
    status:
      event.state ||
      event.status ||
      (event.type === "plan"
        ? "awaiting_approval"
        : event.type === "progress"
          ? "building"
          : previous?.status),
    count,
    progress: progress === null ? null : Math.max(0, Math.min(100, progress)),
  };
}
