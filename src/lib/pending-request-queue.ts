export interface PendingRequestAcceptance {
  accepted: boolean;
  /** True only when the native head could not safely be advanced. */
  shouldRetainPending: boolean;
  /** Wrong-network payload removed from the native head for fair retry later. */
  deferredForNetworkSwitch?: boolean;
}

export interface PendingRequestDrainDeps {
  getPendingRequest: () => Promise<string | null>;
  acceptPendingRequest: (payload: string) => Promise<PendingRequestAcceptance>;
  onAccepted: (payload: string) => Promise<void> | void;
  onDeferred?: (payload: string) => Promise<void> | void;
}

const deferredRequests: string[] = [];

export function deferPendingRequest(payload: string): void {
  if (!deferredRequests.includes(payload)) deferredRequests.push(payload);
}

export async function retryDeferredRequests(
  accept: (payload: string) => Promise<boolean>,
  onAccepted: (payload: string) => Promise<void> | void,
): Promise<void> {
  for (let index = 0; index < deferredRequests.length;) {
    const payload = deferredRequests[index];
    if (await accept(payload)) {
      deferredRequests.splice(index, 1);
      await onAccepted(payload);
    } else {
      index += 1;
    }
  }
}

/** Drains native requests in FIFO order without allowing a wrong-network head to starve later work. */
export async function drainPendingRequests(deps: PendingRequestDrainDeps): Promise<void> {
  while (true) {
    const payload = await deps.getPendingRequest();
    if (!payload) return;

    const result = await deps.acceptPendingRequest(payload);
    if (result.accepted) await deps.onAccepted(payload);
    if (result.deferredForNetworkSwitch) await deps.onDeferred?.(payload);
    if (result.shouldRetainPending) return;

    if ((await deps.getPendingRequest()) === payload) return;
  }
}
