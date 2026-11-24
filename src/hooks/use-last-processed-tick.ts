import { useQuery } from "@tanstack/react-query";
import { getStatus } from "@/lib/api/generated";
import { getStatusQueryKey } from "@/lib/api/generated/@tanstack/react-query.gen";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

/** Polls the index head from the Glyph API status route. */
export function useLastProcessedTick() {
  const pollingIntervalMs = usePollingIntervalMs();
  const apiIdentity = useApiCacheIdentity();
  return useQuery({
    queryKey: [...getStatusQueryKey(), apiIdentity],
    queryFn: async () => (await getStatus({ throwOnError: true })).data,
    select: (response) => {
      const status = response?.data;
      const tick = status?.ingest_status?.last_indexed_tick ?? status?.head?.tick ?? 0;
      return {
        tickNumber: tick,
        epoch: status?.head?.epoch ?? status?.network?.epoch ?? null,
        intervalInitialTick: status?.network?.initial_tick ?? 0,
        logTickNumber: tick,
      };
    },
    refetchInterval: Math.max(3_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });
}
