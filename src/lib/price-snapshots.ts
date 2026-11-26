import type { PriceSnapshot } from "@/store/persisted";

/** Nearest recorded price snapshot to a transaction timestamp. */
export function findClosestPriceSnapshot(timestamp: number | null, snapshots: PriceSnapshot[]): PriceSnapshot | null {
  if (!timestamp || snapshots.length === 0) return null;
  let best: PriceSnapshot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const snapshot of snapshots) {
    const distance = Math.abs(snapshot.timestamp - timestamp);
    if (distance < bestDistance) {
      best = snapshot;
      bestDistance = distance;
    }
  }
  return best;
}
