import { useShallow } from "zustand/react/shallow";
import { rpcCacheIdentity, type RpcCacheScope } from "@/lib/rpc-cache-identity";
import { usePersistedStore } from "@/store/persisted";

export function useRpcCacheIdentity(scope: RpcCacheScope = "both") {
  const network = usePersistedStore(
    useShallow((s) => ({
      liveApiUrl: s.settings.network.liveApiUrl,
      queryApiUrl: s.settings.network.queryApiUrl,
    })),
  );
  return rpcCacheIdentity(network, scope);
}
