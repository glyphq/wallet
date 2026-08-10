import { describe, expect, test } from "bun:test";
import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL } from "@/lib/rpc";
import { identifyNetworkPreset, NETWORK_PRESETS } from "./network-presets";

describe("network presets", () => {
  test("includes a nonconfigured testnet aid without URLs", () => {
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

  test("identifies only the verified bundled mainnet endpoints as mainnet", () => {
    expect(identifyNetworkPreset(`${DEFAULT_LIVE_URL}/`, `${DEFAULT_ARCHIVE_URL}/`)).toBe("mainnet");
  });

  test("does not identify arbitrary endpoints as testnet", () => {
    expect(identifyNetworkPreset("https://live.example/v1", "https://archive.example/v1")).toBe("custom");
  });

  test("falls back to custom when endpoints are incomplete", () => {
    expect(identifyNetworkPreset("", "")).toBe("custom");
  });
});
