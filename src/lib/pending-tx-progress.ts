/** Extra ticks allowed after the target tick before a pending tx is called expired. */
export const PENDING_EXPIRY_GRACE_TICKS = 30;

export type PendingPhase = "waiting" | "confirming" | "expired";

export interface PendingTxProgress {
  phase: PendingPhase;
  /** Ticks until the target tick; zero once reached. */
  remainingTicks: number;
  /** Ticks until the expiry grace ends; zero once expired. */
  ticksToExpiry: number;
  expiryTick: number;
  /** Examples: "5 ticks to target", "Awaiting confirmation · 29 ticks to expiry". */
  timingText: string;
  /** Examples: "Pending", "Confirming", "Failed". */
  label: string;
}

function tickWord(count: number): string {
  return count === 1 ? "tick" : "ticks";
}

/** Describes pending-tx progress from the streamed index tick. */
export function pendingTxProgress(targetTick: number, currentTick: number): PendingTxProgress {
  const expiryTick = targetTick + PENDING_EXPIRY_GRACE_TICKS;
  const known = currentTick > 0;
  const remainingTicks = known ? Math.max(0, targetTick - currentTick) : 0;
  const ticksToExpiry = known ? Math.max(0, expiryTick - currentTick) : PENDING_EXPIRY_GRACE_TICKS;

  if (known && currentTick > expiryTick) {
    return {
      phase: "expired",
      remainingTicks: 0,
      ticksToExpiry: 0,
      expiryTick,
      timingText: `Expired at tick ${expiryTick}`,
      label: "Failed",
    };
  }

  if (known && currentTick >= targetTick) {
    return {
      phase: "confirming",
      remainingTicks: 0,
      ticksToExpiry,
      expiryTick,
      timingText: `Awaiting confirmation · ${ticksToExpiry} ${tickWord(ticksToExpiry)} to expiry`,
      label: "Confirming",
    };
  }

  return {
    phase: "waiting",
    remainingTicks,
    ticksToExpiry,
    expiryTick,
    timingText: known
      ? `${remainingTicks} ${tickWord(remainingTicks)} to target`
      : `Target tick ${targetTick}`,
    label: "Pending",
  };
}
