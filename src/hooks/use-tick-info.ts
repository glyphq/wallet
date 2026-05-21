import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { getBobRpcClient } from "@/lib/bob-client";
import { usePersistedStore } from "@/store/persisted";
import { qk } from "@/lib/query-keys";

/** Polls current tick and epoch info every 5 s. Used as the network heartbeat. */
export function useTickInfo() {
  const useBobNode = usePersistedStore((s) => s.settings.network.useBobNode);
  const bobRestUrl = usePersistedStore((s) => s.settings.network.bobRestUrl);

  return useQuery({
    queryKey: [...qk.tickInfo(), useBobNode ? "bob" : "rpc"],
    queryFn: async () => {
      if (useBobNode && bobRestUrl) {
        const bob = getBobRpcClient(bobRestUrl);
        const [tickResult, epochResult] = await Promise.all([
          bob.getTickNumber(),
          bob.getCurrentEpoch(),
        ]);
        if (!tickResult.ok) throw tickResult.error;
        return {
          tick: tickResult.value,
          epoch: epochResult.ok ? epochResult.value : 0,
          duration: 0,
          initialTick: 0,
        };
      }
      const result = await getRpcClient().live.getTickInfo();
      if (!result.ok) throw result.error;
      return result.value;
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
