import { describe, expect, test } from "bun:test";
import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL } from "@/lib/rpc";
import {
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_QUERY_API_URL,
} from "./network-config";
import { identifyNetworkPreset, NETWORK_PRESETS } from "./network-presets";

describe("network presets", () => {
  test("includes configured mainnet, local testnet, and custom presets", () => {
    expect(NETWORK_PRESETS.map((preset) => preset.id)).toEqual([
      "mainnet",
      "testnet",
      "custom",
    ]);
    expect(NETWORK_PRESETS[0]).toMatchObject({
      id: "mainnet",
      label: "Mainnet",
      liveApiUrl: DEFAULT_LIVE_URL,
      queryApiUrl: DEFAULT_ARCHIVE_URL,
    });
    expect(NETWORK_PRESETS[1]).toEqual({
      id: "testnet",
      label: "Local testnet",
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
    });
  });

  test("identifies canonical bundled endpoint pairs after normalization", () => {
    expect(
      identifyNetworkPreset(`${DEFAULT_LIVE_URL}/`, `${DEFAULT_ARCHIVE_URL}/`)
    ).toBe("mainnet");
    expect(
      identifyNetworkPreset(
        `${LOCAL_TESTNET_LIVE_API_URL}/`,
        `${LOCAL_TESTNET_QUERY_API_URL}/`
      )
    ).toBe("testnet");
  });

  test("identifies arbitrary valid endpoint pairs as custom", () => {
    expect(
      identifyNetworkPreset(
        "https://live.example/v1",
        "https://archive.example/v1"
      )
    ).toBe("custom");
  });

  test("keeps invalid or incomplete settings drafts out of a bundled preset", () => {
    expect(identifyNetworkPreset("", "")).toBe("custom");
    expect(
      identifyNetworkPreset(
        "http://rpc.example/live/v1",
        "http://rpc.example/query/v1"
      )
    ).toBe("custom");
  });
});
