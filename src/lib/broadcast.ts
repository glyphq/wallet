import { getRpcClient } from "@/lib/rpc";
import { getBobRestClient } from "@/lib/bob-client";
import { usePersistedStore } from "@/store/persisted";

/**
 * Broadcasts a base64-encoded signed transaction.
 * Routes to the Bob REST client when Bob node is enabled, otherwise uses the Qubic RPC live client.
 */
export async function broadcastTx(encoded: string): Promise<void> {
  const { useBobNode, bobRestUrl } = usePersistedStore.getState().settings.network;
  if (useBobNode && bobRestUrl) {
    const result = await getBobRestClient(bobRestUrl).broadcastTransaction({ data: encoded });
    if (!result.ok) throw result.error;
    return;
  }
  const result = await getRpcClient().live.broadcastTransaction(encoded);
  if (!result.ok) throw result.error;
}
