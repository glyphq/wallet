import { broadcastTransaction } from "@/lib/api/generated";
import { apiErrorMessage } from "@/lib/api/problems";
import { base64ToBytes } from "@/lib/base64";
import { bytesToHex } from "@/lib/hex";

/**
 * Broadcasts a base64-encoded signed transaction through the Glyph API.
 * The tracked path validates and makes the first peer attempt before returning.
 */
export async function broadcastTx(encoded: string): Promise<void> {
  const raw = bytesToHex(base64ToBytes(encoded));
  if (!raw) throw new Error("Signed transaction is empty");

  const { error, response } = await broadcastTransaction({
    body: { raw },
  });
  const status = response?.status ?? 0;
  if (!response?.ok) {
    throw new Error(apiErrorMessage(error, status));
  }
}
