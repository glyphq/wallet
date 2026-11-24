import { ok, err, type SmartContractCaller } from "@qubic.org/contracts";
import { bytesToHex, hexToBytes } from "@/lib/hex";
import { queryContract } from "./generated";

class GlyphContractError extends Error {
  readonly code = "RPC_ERROR" as const;
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string, message: string) {
    super(message);
    this.name = "QubicRpcError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Adapts the contract read helpers in `@qubic.org/contracts` to the Glyph API
 * contract-query route. The helpers still encode and decode payloads; only the
 * transport changes (base64 in the official RPC, hex in the Glyph API).
 */
export const glyphContractCaller: SmartContractCaller = {
  async querySmartContract(request) {
    const contractIndex = request.contractIndex ?? 0;
    const endpoint = `/v1/live/contracts/${contractIndex}/query`;
    const input = base64ToBytes(request.requestData ?? "");
    if (!input) return err(new GlyphContractError(400, endpoint, "Contract input is not valid base64"));

    const { data, error, response } = await queryContract({
      path: { contract_index: contractIndex },
      body: { input_type: request.inputType, input: bytesToHex(input) },
    });
    const status = response?.status ?? 0;
    if (error || !data?.data) {
      const message =
        error && typeof error === "object" && "detail" in error && typeof error.detail === "string"
          ? error.detail
          : `Contract query failed (${status})`;
      return err(new GlyphContractError(status, endpoint, message));
    }

    const output = hexToBytes(data.data.output ?? "");
    if (!output) return err(new GlyphContractError(502, endpoint, "Contract output is not valid hex"));
    return ok({ responseData: bytesToBase64(output) });
  },
};
