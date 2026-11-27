export type TxResolutionStatus = "confirmed" | "failed" | "expired";

export interface TxResolution {
  hash: string;
  status: TxResolutionStatus;
  /** True when value or assets moved; null when the peer cannot tell. */
  moneyFlew: boolean | null;
  includedTick: number | null;
}

interface LifecycleDocument {
  data?: {
    state?: unknown;
    money_flew?: unknown;
    included_tick?: unknown;
  };
}

export interface LifecycleProgress {
  state: string;
  moneyFlew: boolean | null;
  includedTick: number | null;
}

function terminalResolution(
  hash: string,
  state: string,
  moneyFlew: boolean | null,
  includedTick: number | null,
): TxResolution | null {
  switch (state) {
    case "confirmed":
      return {
        hash,
        status: moneyFlew === false ? "failed" : "confirmed",
        moneyFlew,
        includedTick,
      };
    case "failed":
      return { hash, status: "failed", moneyFlew: false, includedTick };
    case "expired":
    case "missed":
    case "cancelled":
      return { hash, status: "expired", moneyFlew, includedTick };
    default:
      return null;
  }
}

/** Maps a compact lifecycle-stream progress payload to a terminal resolution. */
export function resolutionFromLifecycleProgress(
  hash: string,
  progress: LifecycleProgress,
): TxResolution | null {
  return terminalResolution(hash, progress.state, progress.moneyFlew, progress.includedTick);
}

/**
 * Maps a lifecycle document to a terminal resolution. Non-terminal states
 * (`queued`, `broadcast`, `pending`, `confirmed` without a peer verdict is
 * still terminal by inclusion) return null.
 */
export function resolutionFromLifecycle(hash: string, payload: unknown): TxResolution | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as LifecycleDocument).data;
  if (!data || typeof data.state !== "string") return null;

  const moneyFlew =
    typeof data.money_flew === "boolean" ? data.money_flew : null;
  const includedTick =
    typeof data.included_tick === "number" ? data.included_tick : null;

  return terminalResolution(hash, data.state, moneyFlew, includedTick);
}
