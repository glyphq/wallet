import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { createRpcCacheSnapshot, type RpcCacheScope } from "@/lib/rpc-cache-identity";
import { usePersistedStore } from "@/store/persisted";

export function useRpcCacheSnapshot(scope: RpcCacheScope = "both") {
  const network = usePersistedStore(
    useShallow((s) => ({
      name: s.settings.network.name,
      liveApiUrl: s.settings.network.liveApiUrl,
      queryApiUrl: s.settings.network.queryApiUrl,
      scope: s.settings.network.scope,
      manifestInstanceId: s.settings.network.manifestInstanceId,
    })),
  );
  return useMemo(() => createRpcCacheSnapshot(network, scope), [network, scope]);
}

export function useRpcCacheIdentity(scope: RpcCacheScope = "both") {
  return useRpcCacheSnapshot(scope).identity;
}
