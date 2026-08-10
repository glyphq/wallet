import { describe, expect, test } from "bun:test";
import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL } from "@/lib/rpc";
import { identifyNetworkPreset, NETWORK_PRESETS } from "./network-presets";

describe("network presets", () => {
  test("includes mainnet and testnet without unverified testnet URLs", () => {
    expect(NETWORK_PRESETS.map((preset) => preset.id)).toEqual(["mainnet", "testnet", "custom"]);
    expect(NETWORK_PRESETS[0]).toMatchObject({
      id: "mainnet",
      liveApiUrl: DEFAULT_LIVE_URL,
      queryApiUrl: DEFAULT_ARCHIVE_URL,
    });
    expect(NETWORK_PRESETS[1]).toMatchObject({
      id: "testnet",
      liveApiUrl: null,
      queryApiUrl: null,
    });
  });

  test("identifies the verified bundled mainnet endpoints", () => {
    expect(identifyNetworkPreset(`${DEFAULT_LIVE_URL}/`, `${DEFAULT_ARCHIVE_URL}/`, "custom")).toBe("mainnet");
  });

  test("preserves an explicit testnet selection for custom HTTPS endpoints", () => {
    expect(identifyNetworkPreset("https://live.example/v1", "https://archive.example/v1", "testnet")).toBe("testnet");
  });

  test("falls back to custom for non-mainnet endpoints", () => {
    expect(identifyNetworkPreset("https://live.example/v1", "https://archive.example/v1", "custom")).toBe("custom");
  });
});
