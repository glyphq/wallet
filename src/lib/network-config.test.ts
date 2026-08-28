import { describe, expect, test } from "bun:test";
import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL } from "@/lib/rpc";
import {
  InvalidNetworkConfigError,
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_NETWORK_CONFIG,
  LOCAL_TESTNET_QUERY_API_URL,
  MAINNET_NETWORK_CONFIG,
  MAINNET_NETWORK_SCOPE,
  localTestnetNetworkScope,
  normalizeNetworkRpcUrl,
  parsePersistedNetworkConfig,
  resolveNetworkConfig,
  tryResolveNetworkConfig,
} from "./network-config";

const INSTANCE_A = `qubic-local:${"a".repeat(64)}`;
const INSTANCE_B = `qubic-local:${"b".repeat(64)}`;

describe("canonical network configuration", () => {
  test("resolves mainnet from its endpoints and derives a fixed scope", () => {
    expect(
      resolveNetworkConfig({
        liveApiUrl: `${DEFAULT_LIVE_URL}/`,
        queryApiUrl: `${DEFAULT_ARCHIVE_URL}/`,
      })
    ).toEqual(MAINNET_NETWORK_CONFIG);
    expect(MAINNET_NETWORK_CONFIG.scope).toBe(MAINNET_NETWORK_SCOPE);
    expect(MAINNET_NETWORK_CONFIG.name).toBe("mainnet");
  });

  test("uses the exact local dev-kit live and query paths", () => {
    expect(LOCAL_TESTNET_LIVE_API_URL).toBe(
      "http://127.0.0.1:41841/live/v1"
    );
    expect(LOCAL_TESTNET_QUERY_API_URL).toBe(
      "http://127.0.0.1:41841/query/v1"
    );
    expect(LOCAL_TESTNET_NETWORK_CONFIG).toMatchObject({
      name: "testnet",
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
      manifestInstanceId: null,
    });
  });

  test("changes local testnet scope when the wipe-sensitive manifest instanceId changes", () => {
    const first = resolveNetworkConfig({
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
      manifestInstanceId: INSTANCE_A,
    });
    const second = resolveNetworkConfig({
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
      manifestInstanceId: INSTANCE_B,
    });

    expect(first.name).toBe("testnet");
    expect(first.scope).toBe(localTestnetNetworkScope(INSTANCE_A));
    expect(first.scope).not.toBe(second.scope);
    expect(LOCAL_TESTNET_NETWORK_CONFIG.scope).toBe(
      localTestnetNetworkScope(null)
    );
  });

  test("derives a stable custom scope from canonical endpoint URLs", () => {
    const a = resolveNetworkConfig({
      liveApiUrl: " https://live.example/v1/ ",
      queryApiUrl: "https://query.example/v1/",
    });
    const b = resolveNetworkConfig({
      liveApiUrl: "https://live.example/v1",
      queryApiUrl: "https://query.example/v1",
    });

    expect(a.name).toBe("custom");
    expect(a.scope).toBe(b.scope);
    expect(a.scope).toStartWith("qubic:custom:");
  });

  test("allows plain HTTP only for the exact local dev-kit RPC bases", () => {
    expect(
      normalizeNetworkRpcUrl("http://127.0.0.1:41841/live/v1/")
    ).toBe(LOCAL_TESTNET_LIVE_API_URL);
    expect(normalizeNetworkRpcUrl("http://localhost:41841/live/v1")).toBeNull();
    expect(normalizeNetworkRpcUrl("http://127.0.0.1:9999/live/v1")).toBeNull();
    expect(normalizeNetworkRpcUrl("http://127.0.0.1:41841")).toBeNull();
    expect(normalizeNetworkRpcUrl("http://127.0.0.1:41841/wrong/v1")).toBeNull();
    expect(
      normalizeNetworkRpcUrl("http://user:pass@127.0.0.1:41841/live/v1")
    ).toBeNull();
    expect(
      normalizeNetworkRpcUrl("http://127.0.0.1:41841/live/v1?query=1")
    ).toBeNull();
    expect(
      normalizeNetworkRpcUrl("http://127.0.0.1:41841/live/v1#fragment")
    ).toBeNull();
    expect(normalizeNetworkRpcUrl("http://rpc.example/live/v1")).toBeNull();
    expect(
      normalizeNetworkRpcUrl("https://user:pass@rpc.example/live/v1")
    ).toBeNull();
  });

  test("fails closed for invalid endpoint pairs instead of returning mainnet", () => {
    expect(
      tryResolveNetworkConfig({
        liveApiUrl: "not a url",
        queryApiUrl: "http://rpc.example/query/v1",
      })
    ).toBeNull();
    expect(() =>
      resolveNetworkConfig({ liveApiUrl: "", queryApiUrl: "" })
    ).toThrow(InvalidNetworkConfigError);
  });

  test("rejects manifest identity on networks where it cannot define scope", () => {
    expect(() =>
      resolveNetworkConfig({
        liveApiUrl: DEFAULT_LIVE_URL,
        queryApiUrl: DEFAULT_ARCHIVE_URL,
        manifestInstanceId: INSTANCE_A,
      })
    ).toThrow("only valid for the bundled local testnet");
  });

  test("accepts only the exact dev-kit manifest instanceId contract", () => {
    expect(
      resolveNetworkConfig({
        liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
        queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
        manifestInstanceId: INSTANCE_A,
      }).manifestInstanceId
    ).toBe(INSTANCE_A);

    for (const manifestInstanceId of [
      "",
      `wrong:${"a".repeat(64)}`,
      `qubic-local:${"A".repeat(64)}`,
      `qubic-local:${"a".repeat(63)}`,
      `qubic-local:${"a".repeat(65)}`,
      `qubic-local:${"a".repeat(63)}\n`,
    ]) {
      expect(() =>
        resolveNetworkConfig({
          liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
          queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
          manifestInstanceId,
        })
      ).toThrow("manifest instanceId is invalid");
    }
  });

  test("strictly rejects persisted name or scope divergence", () => {
    expect(
      parsePersistedNetworkConfig({ ...MAINNET_NETWORK_CONFIG })
    ).toEqual(MAINNET_NETWORK_CONFIG);
    expect(() =>
      parsePersistedNetworkConfig({
        ...MAINNET_NETWORK_CONFIG,
        name: "testnet",
      })
    ).toThrow("does not match its endpoints");
    expect(() =>
      parsePersistedNetworkConfig({
        ...MAINNET_NETWORK_CONFIG,
        scope: "qubic:custom:forged",
      })
    ).toThrow("does not match its endpoints");
  });
});
