import type { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import { createQubicClient, type QubicClient } from "@qubic.org/rpc";
import type { NetworkConfig } from "@/lib/network-config";
import { resolveNetworkConfig } from "@/lib/network-config";
import { rpcFetch } from "@/lib/rpc-transport";

export type RpcCacheScope = "live" | "archive" | "both";

export interface RpcCacheSnapshot {
  readonly network: Readonly<NetworkConfig>;
  readonly identity: string;
  readonly client: QubicClient;
}

/** Creates an RPC client bound only to this canonical network configuration. */
export function createRpcClientForNetwork(network: NetworkConfig): QubicClient {
  const resolved = resolveNetworkConfig(network);
  return createQubicClient({
    liveBaseUrl: resolved.liveApiUrl,
    archiveBaseUrl: resolved.queryApiUrl,
    fetch: rpcFetch,
  });
}

export function rpcCacheIdentity(
  network: NetworkConfig,
  scope: RpcCacheScope = "both",
): string {
  const resolved = resolveNetworkConfig(network);
  const networkScope = resolved.scope;

  if (scope === "live") return `${networkScope}|live:${resolved.liveApiUrl}`;
  if (scope === "archive") return `${networkScope}|archive:${resolved.queryApiUrl}`;
  return `${networkScope}|live:${resolved.liveApiUrl}|archive:${resolved.queryApiUrl}`;
}

export function createRpcCacheSnapshot(
  network: NetworkConfig,
  scope: RpcCacheScope = "both",
): RpcCacheSnapshot {
  const resolved = Object.freeze(resolveNetworkConfig(network));
  return Object.freeze({
    network: resolved,
    identity: rpcCacheIdentity(resolved, scope),
    client: createRpcClientForNetwork(resolved),
  });
}

export function isRpcScopedQueryKey(queryKey: readonly unknown[], networkScope: string): boolean {
  return queryKey.some(
    (part) => typeof part === "string" && (part === networkScope || part.startsWith(`${networkScope}|`)),
  );
}

/** Cancel first so a late obsolete response cannot repopulate its cache entry. */
export async function invalidateObsoleteRpcQueries(
  queryClient: TanstackQueryClient,
  networkScope: string,
): Promise<void> {
  const predicate = (query: { queryKey: readonly unknown[] }) =>
    isRpcScopedQueryKey(query.queryKey, networkScope);
  await queryClient.cancelQueries({ predicate });
  await queryClient.invalidateQueries({ predicate, refetchType: "none" });
}
