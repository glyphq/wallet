import { describe, expect, test } from "bun:test";
import { activeNetworkBinding } from "@/lib/network-binding";
import { LOCAL_TESTNET_LIVE_API_URL, LOCAL_TESTNET_QUERY_API_URL, MAINNET_NETWORK_CONFIG, resolveNetworkConfig } from "@/lib/network-config";

const INSTANCE_A = `qubic-local:${"a".repeat(64)}`;
const INSTANCE_B = `qubic-local:${"b".repeat(64)}`;

describe("active network binding", () => {
  test("preserves the full wipe-sensitive local instance scope", async () => {
    const a = resolveNetworkConfig({ liveApiUrl: LOCAL_TESTNET_LIVE_API_URL, queryApiUrl: LOCAL_TESTNET_QUERY_API_URL, manifestInstanceId: INSTANCE_A });
    const b = resolveNetworkConfig({ liveApiUrl: LOCAL_TESTNET_LIVE_API_URL, queryApiUrl: LOCAL_TESTNET_QUERY_API_URL, manifestInstanceId: INSTANCE_B });
    expect((await activeNetworkBinding(a)).id).toBe(a.scope);
    expect((await activeNetworkBinding(b)).id).toBe(b.scope);
    expect((await activeNetworkBinding(a)).id).not.toBe((await activeNetworkBinding(b)).id);
  });

  test("fails closed for forged configs instead of falling back to mainnet", async () => {
    await expect(activeNetworkBinding({ ...MAINNET_NETWORK_CONFIG, liveApiUrl: "" })).rejects.toThrow();
  });

  test("hashes canonical custom scope deterministically", async () => {
    const config = resolveNetworkConfig({ liveApiUrl: "https://live.example/v1", queryApiUrl: "https://query.example/v1" });
    expect(await activeNetworkBinding(config)).toEqual(await activeNetworkBinding(config));
    expect((await activeNetworkBinding(config)).id).toMatch(/^qubic:custom:sha256:[A-Za-z0-9_-]{43}$/);
  });
});
