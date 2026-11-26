import { useTickInfo } from "./use-tick-info";

export type NetworkHealth = "healthy" | "degraded" | "offline";

/** Milliseconds since last successful tick before reporting network as degraded */
const DEGRADED_THRESHOLD_MS = 15_000;

/** Derives network health from the status query — "healthy", "degraded", or "offline". */
export function useNetworkHealth(): NetworkHealth {
  const { data, isError, isSuccess, dataUpdatedAt } = useTickInfo();
  if (isError) return "offline";
  if (isSuccess && data && !data.reachable) return "degraded";
  if (isSuccess && Date.now() - dataUpdatedAt > DEGRADED_THRESHOLD_MS) return "degraded";
  if (isSuccess) return "healthy";
  return "degraded";
}
