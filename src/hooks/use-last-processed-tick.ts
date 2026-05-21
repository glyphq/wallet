import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { getBobRpcClient } from "@/lib/bob-client";
import { usePersistedStore } from "@/store/persisted";
import { qk } from "@/lib/query-keys";

/** Polls the archive for the last processed tick every 3 s. Used to detect when pending txs should be confirmed. */
export function useLastProcessedTick() {
  const useBobNode = usePersistedStore((s) => s.settings.network.useBobNode);
  const bobRestUrl = usePersistedStore((s) => s.settings.network.bobRestUrl);

  return useQuery({
    queryKey: [...qk.lastProcessedTick(), useBobNode ? "bob" : "rpc"],
    queryFn: async () => {
      if (useBobNode && bobRestUrl) {
        const result = await getBobRpcClient(bobRestUrl).getTickNumber();
        if (!result.ok) throw result.error;
        return { tickNumber: result.value };
      }
      const result = await getRpcClient().archive.getLastProcessedTick();
      if (!result.ok) throw result.error;
      return result.value;
    },
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });
}
