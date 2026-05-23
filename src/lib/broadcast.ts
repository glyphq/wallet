import { getRpcClient } from "@/lib/rpc";

/**
 * Broadcasts a base64-encoded signed transaction via the main Qubic RPC.
 */
export async function broadcastTx(encoded: string): Promise<void> {
  const result = await getRpcClient().live.broadcastTransaction(encoded);
  if (!result.ok) throw result.error;
}
