import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStatus, type GetStatusResponse } from "@/lib/api/generated";
import { getStatusQueryKey } from "@/lib/api/generated/@tanstack/react-query.gen";
import { subscribeTickStream } from "@/lib/api/stream-broker";
import { applyTickToStatus } from "@/lib/api/stream-cache";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

/** Current peer head and epoch reported by the Glyph API. Used as the network heartbeat. */
export interface TickInfo {
  tick: number;
  epoch: number | null;
  initialTick: number | null;
  duration: number | null;
  reachable: boolean;
}

/** Loads `/v1/status` once, then advances the cached head from the tick stream. */
export function useTickInfo() {
  const apiIdentity = useApiCacheIdentity();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => [...getStatusQueryKey(), apiIdentity], [apiIdentity]);

  useEffect(() => subscribeTickStream(apiIdentity, (tick) => {
    queryClient.setQueryData<GetStatusResponse>(queryKey, (previous) => applyTickToStatus(previous, tick));
  }), [apiIdentity, queryClient, queryKey]);

  return useQuery({
    queryKey,
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
    staleTime: Infinity,
    refetchOnWindowFocus: "always",
  });
}
