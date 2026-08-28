import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import {
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_QUERY_API_URL,
  MAINNET_NETWORK_CONFIG,
  resolveNetworkConfig,
} from "@/lib/network-config";
import {
  createRpcClientForNetwork,
  createRpcCacheSnapshot,
  invalidateObsoleteRpcQueries,
  rpcCacheIdentity,
} from "@/lib/rpc-cache-identity";
import { getRpcClient } from "@/lib/rpc";

const INSTANCE_A = `qubic-local:${"a".repeat(64)}`;
const INSTANCE_B = `qubic-local:${"b".repeat(64)}`;

function local(instanceId: string) {
  return resolveNetworkConfig({
    liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
    queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
    manifestInstanceId: instanceId,
  });
}

describe("rpc cache identity", () => {
  test("preserves mainnet endpoint compatibility while including canonical network scope", () => {
    expect(rpcCacheIdentity(MAINNET_NETWORK_CONFIG, "live")).toBe(
      `qubic:mainnet|live:${MAINNET_NETWORK_CONFIG.liveApiUrl}`,
    );
    expect(rpcCacheIdentity(MAINNET_NETWORK_CONFIG, "archive")).toBe(
      `qubic:mainnet|archive:${MAINNET_NETWORK_CONFIG.queryApiUrl}`,
    );
  });

  test("isolates a wiped local node even when its endpoints are unchanged", () => {
    const beforeWipe = local(INSTANCE_A);
    const afterWipe = local(INSTANCE_B);

    expect(beforeWipe.liveApiUrl).toBe(afterWipe.liveApiUrl);
    expect(beforeWipe.queryApiUrl).toBe(afterWipe.queryApiUrl);
    expect(rpcCacheIdentity(beforeWipe)).not.toBe(rpcCacheIdentity(afterWipe));
    expect(rpcCacheIdentity(beforeWipe)).toContain(beforeWipe.scope);
    expect(rpcCacheIdentity(afterWipe)).toContain(afterWipe.scope);
  });

  test("creates immutable, independently bound network/client snapshots", () => {
    const first = createRpcCacheSnapshot(MAINNET_NETWORK_CONFIG, "both");
    const custom = resolveNetworkConfig({
      liveApiUrl: "https://live.example/v1/",
      queryApiUrl: "https://archive.example/query/",
    });
    const second = createRpcCacheSnapshot(custom, "both");

    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.network)).toBe(true);
    expect(first.client).not.toBe(second.client);
    expect(first.identity).toContain(MAINNET_NETWORK_CONFIG.scope);
    expect(second.identity).toContain(custom.scope);
    expect(first.network).toEqual(MAINNET_NETWORK_CONFIG);
  });

  test("creates a candidate client without mutating the active singleton", () => {
    const active = getRpcClient();
    const candidate = createRpcClientForNetwork(resolveNetworkConfig({
      liveApiUrl: "https://candidate-live.example/v1",
      queryApiUrl: "https://candidate-query.example/v1",
    }));

    expect(candidate).not.toBe(active);
    expect(getRpcClient()).toBe(active);
  });

  test("cancels every identity variant for the obsolete scope without touching unrelated keys", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const obsoleteNetwork = local(INSTANCE_A);
    const currentNetwork = local(INSTANCE_B);
    const obsoleteLive = rpcCacheIdentity(obsoleteNetwork, "live");
    const obsoleteArchive = rpcCacheIdentity(obsoleteNetwork, "archive");
    const obsoleteBoth = rpcCacheIdentity(obsoleteNetwork, "both");
    const current = rpcCacheIdentity(currentNetwork, "live");
    let release!: () => void;
    let aborted = false;

    const obsoleteFetch = client.fetchQuery({
      queryKey: ["tick-info", obsoleteLive],
      queryFn: ({ signal }) => new Promise<string>((resolve, reject) => {
        release = () => resolve("old-network-result");
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
    }).catch(() => undefined);

    client.setQueryData(["history", obsoleteArchive], "old-archive");
    client.setQueryData(["combined", obsoleteBoth], "old-both");
    client.setQueryData(["network-metadata", obsoleteNetwork.scope], "old-scope");
    client.setQueryData(["tick-info", current], "current-network-result");
    client.setQueryData(["latest-stats", "https://price.example"], "non-rpc-result");
    await invalidateObsoleteRpcQueries(client, obsoleteNetwork.scope);
    release();
    await obsoleteFetch;

    expect(aborted).toBe(true);
    expect(client.getQueryData(["tick-info", obsoleteLive])).toBeUndefined();
    expect(client.getQueryState(["tick-info", obsoleteLive])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["history", obsoleteArchive])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["combined", obsoleteBoth])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["network-metadata", obsoleteNetwork.scope])?.isInvalidated).toBe(true);
    expect(client.getQueryData(["tick-info", current])).toBe("current-network-result");
    expect(client.getQueryState(["tick-info", current])?.isInvalidated).toBe(false);
    expect(client.getQueryData(["latest-stats", "https://price.example"])).toBe("non-rpc-result");
    expect(client.getQueryState(["latest-stats", "https://price.example"])?.isInvalidated).toBe(false);
  });
});
