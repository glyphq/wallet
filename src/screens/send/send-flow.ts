import { estimateTargetTick, getLatestTick } from "@/lib/rpc";

/** Step machine shared by the send and send-many flows. */
export type SendStep = "input" | "review" | "sending" | "done" | "error";

/** Confirmation watch state used by the result panes. */
export type WatchResult = "pending" | "confirmed" | "failed";

/** Trim and uppercase an identity for comparison and submission. */
export function normalizeIdentity(value: string): string {
  return value.trim().toUpperCase();
}

/** True when the account already has an unconfirmed outgoing transfer. */
export function hasPendingFromAccount(
  pendingTxs: readonly { source: string }[],
  identity: string,
): boolean {
  return pendingTxs.some((tx) => tx.source === identity);
}

export interface QuAmountValidation {
  /** Parsed amount when the text is a whole positive QU value. */
  amount: bigint | null;
  /** Empty string when valid; otherwise the caller-supplied message. */
  error: string;
}

/**
 * Validates a whole-QU amount string.
 * Messages are supplied by each screen so user-facing copy stays flow-specific.
 */
export function validateQuAmount(
  text: string,
  { balance = null, invalidMessage, insufficientMessage }: {
    balance?: bigint | null;
    invalidMessage: string;
    insufficientMessage: string;
  },
): QuAmountValidation {
  try {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return { amount: null, error: invalidMessage };
    const amount = BigInt(trimmed);
    if (amount <= 0n) return { amount: null, error: invalidMessage };
    if (balance !== null && amount > balance) return { amount, error: insufficientMessage };
    return { amount, error: "" };
  } catch {
    return { amount: null, error: invalidMessage };
  }
}

/** Parses a whole-QU amount, returning null instead of throwing. */
function parseQuAmount(text: string): bigint | null {
  try {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/** Sums positive whole-QU amount strings, ignoring unparsable entries. */
export function sumQuAmounts(amounts: readonly string[]): bigint {
  return amounts.reduce((sum, text) => {
    const amount = parseQuAmount(text);
    return amount !== null && amount > 0n ? sum + amount : sum;
  }, 0n);
}

/** Resolves the current and target tick for a broadcast. */
export async function resolveTargetTick(tickOffset: number): Promise<{ currentTick: number; targetTick: number }> {
  const currentTick = await getLatestTick();
  return { currentTick, targetTick: estimateTargetTick(currentTick, tickOffset) };
}

/** Renders the estimated target tick with the configured offset. */
export function targetTickLabel(tick: number, tickOffset: number): string {
  return String(estimateTargetTick(tick, tickOffset));
}

export function watchStatusLabel(status: WatchResult): string {
  return status === "confirmed" ? "Confirmed" : status === "failed" ? "Failed" : "Watching…";
}

export function watchStatusColor(status: WatchResult, idleColor: string): string {
  return status === "confirmed"
    ? "var(--color-accent)"
    : status === "failed"
      ? "var(--color-status-error)"
      : idleColor;
}
