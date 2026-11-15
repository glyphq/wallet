import type { Identity } from "@qubic.org/types";
import { identityToPublicKey } from "@/lib/crypto";

export type StakeStep = "main" | "confirm" | "sending" | "done" | "error";

export const QEARN_MIN_LOCK = 10_000_000;
export const LOCK_PERIOD_EPOCHS = 52;
export const Q_EARN_POSITION_BATCH_SIZE = 8;

export interface Position {
  epoch: number;
  lockedAmount: bigint;
}

/** Minimal tick fields needed to describe progress within an epoch. */
export interface TickProgressSource {
  tick?: number | null;
  initialTick?: number | null;
  duration?: number | null;
}

const idToPk = (id: string) => identityToPublicKey(id as Identity);

export const SC_OPTS = { identityToPublicKey: idToPk };

/** Fraction of the current epoch that has elapsed, clamped to 0..1. */
export function epochProgressOf(tickInfo: TickProgressSource | null | undefined): number | null {
  if (
    tickInfo?.tick != null &&
    tickInfo?.initialTick != null &&
    tickInfo?.duration != null &&
    tickInfo.duration > 0
  ) {
    return Math.min(1, Math.max(0, (tickInfo.tick - tickInfo.initialTick) / tickInfo.duration));
  }
  return null;
}

/** Ticks left in the current epoch, floored at zero. */
export function ticksRemainingOf(tickInfo: TickProgressSource | null | undefined): number | null {
  if (tickInfo?.tick != null && tickInfo?.initialTick != null && tickInfo?.duration != null) {
    return Math.max(0, tickInfo.initialTick + tickInfo.duration - tickInfo.tick);
  }
  return null;
}

export interface PositionSummary {
  totalLocked: bigint;
  readyPositions: Position[];
  readyAmount: bigint;
  nextMaturityEpoch: number | null;
}

export function summarizePositions(
  positions: Position[] | undefined,
  currentEpoch: number | null,
): PositionSummary {
  const totalLocked = positions?.reduce((sum, p) => sum + p.lockedAmount, 0n) ?? 0n;
  const readyPositions = positions?.filter((p) => currentEpoch !== null && currentEpoch >= p.epoch + LOCK_PERIOD_EPOCHS) ?? [];
  const readyAmount = readyPositions.reduce((sum, p) => sum + p.lockedAmount, 0n);
  const nextMaturityEpoch = positions
    ?.filter((p) => currentEpoch !== null && currentEpoch < p.epoch + LOCK_PERIOD_EPOCHS)
    .map((p) => p.epoch + LOCK_PERIOD_EPOCHS)
    .sort((a, b) => a - b)[0] ?? null;

  return { totalLocked, readyPositions, readyAmount, nextMaturityEpoch };
}
