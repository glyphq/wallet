import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { qk } from "@/lib/query-keys";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";

/** Polls current tick and epoch info every 5 s. Used as the network heartbeat. */
export function useTickInfo() {
  const pollingIntervalMs = usePollingIntervalMs();
  const rpcIdentity = useRpcCacheIdentity("live");
  return useQuery({
    queryKey: qk.tickInfo(rpcIdentity),
    queryFn: async () => {
      const result = await getRpcClient().live.getTickInfo();
      if (!result.ok) throw result.error;
      return result.value;
    },
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: true,
  });
}
