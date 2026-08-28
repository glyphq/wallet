import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useRpcCacheSnapshot } from "@/hooks/use-rpc-cache-identity";

/** Polls current tick and epoch info every 5 s. Used as the network heartbeat. */
export function useTickInfo() {
  const pollingIntervalMs = usePollingIntervalMs();
  const rpc = useRpcCacheSnapshot("live");
  return useQuery({
    queryKey: qk.tickInfo(rpc.identity),
    queryFn: async () => {
      const result = await rpc.client.live.getTickInfo();
      if (!result.ok) throw result.error;
      return result.value;
    },
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: true,
  });
}
