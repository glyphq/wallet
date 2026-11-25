import {
  QUTIL,
  type CallInput,
  type CallName,
  type CallOutput,
  type ContractHandle,
  type ContractShape,
  type DecodeOptions,
  type EncodeOptions,
} from "@glyph-oss/contracts";
import { bytesToHex, hexToBytes } from "@/lib/hex";
import { queryContract } from "./generated";

export type ContractResult<T> = { ok: true; value: T } | { ok: false; error: Error };

class GlyphContractError extends Error {
  readonly code = "RPC_ERROR" as const;
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string, message: string) {
    super(message);
    this.name = "GlyphContractError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export interface ContractQueryOptions {
  encode?: EncodeOptions;
  decode?: DecodeOptions;
}

/** Encodes a function call, queries the Glyph API, and decodes the response with the same ABI. */
export async function queryContractFunction<
  S extends ContractShape,
  N extends CallName<S, "functions">,
>(
  contract: ContractHandle<S>,
  name: N,
  input: CallInput<S, "functions", N>,
  options: ContractQueryOptions = {},
): Promise<ContractResult<CallOutput<S, "functions", N>>> {
  try {
    const call = contract.functions[name];
    if (!call || call.inputType == null) {
      throw new Error(`${contract.name}.${name} is not a queryable function`);
    }

    const payload = contract.encodeFunction(name, input, options.encode);
    const endpoint = `/v1/live/contracts/${contract.contractIndex}/query`;
    const { data, error, response } = await queryContract({
      path: { contract_index: contract.contractIndex },
      body: { input_type: call.inputType, input: bytesToHex(payload) },
    });
    const status = response?.status ?? 0;

    if (error || !data?.data) {
      const message =
        error && typeof error === "object" && "detail" in error && typeof error.detail === "string"
          ? error.detail
          : `Contract query failed (${status})`;
      throw new GlyphContractError(status, endpoint, message);
    }

    const output = hexToBytes(data.data.output ?? "");
    if (!output) throw new GlyphContractError(502, endpoint, "Contract output is not valid hex");
    return { ok: true, value: contract.decodeFunctionOutput(name, output, options.decode) };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause : new Error(String(cause)),
    };
  }
}

export function getQutilSendManyFee() {
  return queryContractFunction(QUTIL, "GetSendToManyV1Fee", {});
}

export function getQutilBalances16(publicKeys: readonly string[]) {
  return queryContractFunction(QUTIL, "GetBalances16", { publicKeys });
}
