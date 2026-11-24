import { useQuery } from "@tanstack/react-query";
import { getStatus } from "@/lib/api/generated";
import { getStatusQueryKey } from "@/lib/api/generated/@tanstack/react-query.gen";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

/** Current peer head and epoch reported by the Glyph API. Used as the network heartbeat. */
export interface TickInfo {
  tick: number;
  epoch: number | null;
  initialTick: number | null;
  duration: number | null;
  reachable: boolean;
}

/** Polls `/v1/status` and projects the peer head into the shape the app expects. */
export function useTickInfo() {
  const pollingIntervalMs = usePollingIntervalMs();
  const apiIdentity = useApiCacheIdentity();
  return useQuery({
    queryKey: [...getStatusQueryKey(), apiIdentity],
    queryFn: async () => (await getStatus({ throwOnError: true })).data,
    select: (response): TickInfo => {
      const status = response?.data;
      const network = status?.network;
      const tick = network?.head ?? status?.head?.tick ?? 0;
      return {
        tick,
        epoch: network?.epoch ?? status?.head?.epoch ?? null,
        initialTick: network?.initial_tick ?? null,
        duration: network?.tick_duration ?? null,
        reachable: network?.reachable ?? true,
      };
    },
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: true,
  });
}
