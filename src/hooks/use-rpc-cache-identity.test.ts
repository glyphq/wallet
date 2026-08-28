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

  test("cancels and invalidates only obsolete scoped queries before a late result can land", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const obsolete = rpcCacheIdentity(local(INSTANCE_A));
    const current = rpcCacheIdentity(local(INSTANCE_B));
    let release!: () => void;
    let aborted = false;

    const obsoleteFetch = client.fetchQuery({
      queryKey: ["tick-info", obsolete],
      queryFn: ({ signal }) => new Promise<string>((resolve, reject) => {
        release = () => resolve("old-network-result");
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
    }).catch(() => undefined);

    client.setQueryData(["tick-info", current], "current-network-result");
    await invalidateObsoleteRpcQueries(client, obsolete);
    release();
    await obsoleteFetch;

    expect(aborted).toBe(true);
    expect(client.getQueryData(["tick-info", obsolete])).toBeUndefined();
    expect(client.getQueryState(["tick-info", obsolete])?.isInvalidated).toBe(true);
    expect(client.getQueryData(["tick-info", current])).toBe("current-network-result");
    expect(client.getQueryState(["tick-info", current])?.isInvalidated).toBe(false);
  });
});
