/** A late preparation response can never authorize a subsequently edited plan. */
export function createApprovalGate() {
  let revision = 0;
  let ready = null;
  return {
    invalidate() {
      revision += 1;
      ready = null;
    },
    begin(plan, host) {
      ready = null;
      return { revision: ++revision, fingerprint: plan.fingerprint, count: plan.count, host };
    },
    accept(ticket, response, current, host) {
      if (
        ticket.revision !== revision ||
        ticket.host !== host ||
        ticket.fingerprint !== current.fingerprint ||
        ticket.count !== current.count
      )
        return false;
      if (
        response.requiresConfirmation !== true ||
        response.fingerprint !== ticket.fingerprint ||
        response.count !== ticket.count
      ) {
        throw new Error(
          "The PC plan differs from this preview. Prepare it again before approving.",
        );
      }
      ready = ticket;
      return true;
    },
    matches(plan, host) {
      return Boolean(
        ready &&
        ready.revision === revision &&
        ready.host === host &&
        ready.fingerprint === plan.fingerprint &&
        ready.count === plan.count,
      );
    },
    consume(plan, host) {
      const allowed = this.matches(plan, host);
      this.invalidate();
      return allowed;
    },
  };
}
