import { getStatus } from "./generated";

/** Returns `currentTick + offsetTicks` — the recommended target tick for new transactions. */
export function estimateTargetTick(currentTick: number, offsetTicks = 5): number {
  return currentTick + offsetTicks;
}

/** Reads the newest head exposed by `/v1/status`; the indexed head can be ahead of the peer snapshot. */
export async function fetchLatestTick(): Promise<number> {
  const { data } = await getStatus({ throwOnError: true });
  const networkHead = data?.data?.network?.head ?? 0;
  const indexedHead = data?.data?.head?.tick ?? 0;
  const tick = Math.max(networkHead, indexedHead);
  if (tick <= 0) throw new Error("Failed to fetch current tick");
  return tick;
}
