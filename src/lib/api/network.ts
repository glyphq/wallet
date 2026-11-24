import { getStatus } from "./generated";

/** Returns `currentTick + offsetTicks` — the recommended target tick for new transactions. */
export function estimateTargetTick(currentTick: number, offsetTicks = 5): number {
  return currentTick + offsetTicks;
}

/** Reads the peer head once through `/v1/status`. */
export async function fetchLatestTick(): Promise<number> {
  const { data } = await getStatus({ throwOnError: true });
  const tick = data?.data?.network?.head ?? data?.data?.head?.tick;
  if (tick == null) throw new Error("Failed to fetch current tick");
  return tick;
}
