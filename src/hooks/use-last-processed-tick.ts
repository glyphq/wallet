import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { qk } from "@/lib/query-keys";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";

/** Polls the archive for the last processed tick every 3 s. Used to detect when pending txs should be confirmed. */
export function useLastProcessedTick() {
  const pollingIntervalMs = usePollingIntervalMs();
  const rpcIdentity = useRpcCacheIdentity("archive");
  return useQuery({
    queryKey: qk.lastProcessedTick(rpcIdentity),
    queryFn: async () => {
      const result = await getRpcClient().archive.getLastProcessedTick();
      if (!result.ok) throw result.error;
      return result.value;
    },
    refetchInterval: Math.max(3_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });
}
