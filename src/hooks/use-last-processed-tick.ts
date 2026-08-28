import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useRpcCacheSnapshot } from "@/hooks/use-rpc-cache-identity";

/** Polls the archive for the last processed tick every 3 s. Used to detect when pending txs should be confirmed. */
export function useLastProcessedTick() {
  const pollingIntervalMs = usePollingIntervalMs();
  const rpc = useRpcCacheSnapshot("archive");
  return useQuery({
    queryKey: qk.lastProcessedTick(rpc.identity),
    queryFn: async () => {
      const result = await rpc.client.archive.getLastProcessedTick();
      if (!result.ok) throw result.error;
      return result.value;
    },
    refetchInterval: Math.max(3_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });
}
