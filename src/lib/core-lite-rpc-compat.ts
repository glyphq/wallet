type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Core-lite implements the public RPC routes, but a handful of successful
 * responses are less deeply wrapped than rpc.qubic.org. Normalize only those
 * known routes so @qubic.org/rpc can keep doing its normal typed unwrapping.
 */
export function normalizeCoreLiteRpcPayload(pathname: string, payload: unknown): unknown {
  switch (pathname) {
    case "/live/v1/tick-info": {
      if (!isObject(payload)) return payload;
      const nested = isObject(payload.tickInfo) ? payload.tickInfo : {};
      const topLevelTickInfo = { ...payload };
      delete topLevelTickInfo.tickInfo;
      return { tickInfo: { ...topLevelTickInfo, ...nested } };
    }

    case "/query/v1/getLastProcessedTick": {
      if (!isObject(payload) || typeof payload.logTickNumber === "number") return payload;
      if (typeof payload.tickNumber !== "number") return payload;

      // Core-lite processes live event logs with the same in-memory tick state.
      // Its response omits the archive-only field, so map it to that same tick.
      return { ...payload, logTickNumber: payload.tickNumber };
    }

    case "/query/v1/getProcessedTickIntervals":
      return Array.isArray(payload) ? { processedTickIntervals: payload } : payload;

    case "/query/v1/getTickData":
      return isObject(payload) && !("tickData" in payload) ? { tickData: payload } : payload;

    case "/query/v1/getTransactionByHash":
      return isObject(payload) && !("transaction" in payload) ? { transaction: payload } : payload;

    default:
      return payload;
  }
}

export function normalizeCoreLiteRpcBody(pathname: string, body: string): string {
  if (body.length === 0) return body;

  try {
    const parsed: unknown = JSON.parse(body);
    return JSON.stringify(normalizeCoreLiteRpcPayload(pathname, parsed));
  } catch {
    return body;
  }
}
