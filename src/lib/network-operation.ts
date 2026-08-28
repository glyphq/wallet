export class NetworkChangedError extends Error {
  constructor() {
    super("The active network changed. Review and retry this operation on the intended network.");
    this.name = "NetworkChangedError";
  }
}

/**
 * Chain mutations must capture a network scope before reading ticks or building
 * payloads and re-check that same scope immediately before signing/broadcasting.
 */
export function assertNetworkScopeUnchanged(
  expectedScope: string,
  currentScope: string,
): void {
  if (!expectedScope || expectedScope !== currentScope) {
    throw new NetworkChangedError();
  }
}
