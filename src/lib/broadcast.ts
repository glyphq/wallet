import { getRpcClient } from "@/lib/rpc";
import { assertNetworkScopeUnchanged } from "@/lib/network-operation";
import { usePersistedStore } from "@/store/persisted";

export interface BroadcastTxDeps {
  getCurrentNetworkScope: () => string;
  broadcast: (encoded: string) => Promise<{ ok: boolean; error?: unknown }>;
}

const defaultDeps: BroadcastTxDeps = {
  getCurrentNetworkScope: () => usePersistedStore.getState().settings.network.scope,
  broadcast: (encoded) => getRpcClient().live.broadcastTransaction(encoded),
};

/**
 * Broadcasts a base64-encoded signed transaction only on the immutable network
 * scope captured before tick lookup and signing began.
 */
export async function broadcastTx(
  encoded: string,
  expectedNetworkScope: string,
  deps: BroadcastTxDeps = defaultDeps,
): Promise<void> {
  assertNetworkScopeUnchanged(expectedNetworkScope, deps.getCurrentNetworkScope());
  const result = await deps.broadcast(encoded);
  if (!result.ok) throw result.error;
}
