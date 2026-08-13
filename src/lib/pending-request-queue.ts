export interface PendingRequestDrainDeps {
  getPendingRequest: () => Promise<string | null>;
  acceptPendingRequest: (payload: string) => Promise<{
    accepted: boolean;
    shouldRetainPending: boolean;
  }>;
  onAccepted: (payload: string) => Promise<void> | void;
}

/**
 * Drain native requests strictly from the queue head. Deep-link events only
 * signal that work may be available: consuming their payload directly lets
 * asynchronous listeners accept and clear different queue heads out of order.
 */
export async function drainPendingRequests(deps: PendingRequestDrainDeps): Promise<void> {
  while (true) {
    const payload = await deps.getPendingRequest();
    if (!payload) return;

    const result = await deps.acceptPendingRequest(payload);
    if (result.accepted) {
      await deps.onAccepted(payload);
    }
    if (result.shouldRetainPending) return;

    // Acceptance clears its exact native queue head. If it did not advance,
    // stop rather than skip a request behind it.
    if ((await deps.getPendingRequest()) === payload) return;
  }
}
