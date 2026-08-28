import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { createRpcCacheSnapshot, type RpcCacheScope } from "@/lib/rpc-cache-identity";
import { configureRpc } from "@/lib/rpc";
import { usePersistedStore } from "@/store/persisted";

let rpcStoreSyncInstalled = false;

/**
 * Keeps legacy mutation paths on the active network without mutating during a
 * React render. Zustand listeners run synchronously with each state change.
 */
export function installRpcStoreSync(): void {
  if (rpcStoreSyncInstalled) return;
  rpcStoreSyncInstalled = true;

  let active = usePersistedStore.getState().settings.network;
  configureRpc(active.liveApiUrl, active.queryApiUrl);
  usePersistedStore.subscribe((state) => {
    const next = state.settings.network;
    if (
      next.scope === active.scope &&
      next.liveApiUrl === active.liveApiUrl &&
      next.queryApiUrl === active.queryApiUrl
    ) return;
    active = next;
    configureRpc(next.liveApiUrl, next.queryApiUrl);
  });
}

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
