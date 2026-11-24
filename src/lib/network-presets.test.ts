import { describe, expect, test } from "bun:test";
import { DEFAULT_API_URL } from "@/lib/api-url";
import { identifyNetworkPreset, NETWORK_PRESETS } from "./network-presets";

describe("network presets", () => {
  test("includes a nonconfigured testnet aid without a URL", () => {
    expect(NETWORK_PRESETS.map((preset) => preset.id)).toEqual(["mainnet", "testnet", "custom"]);
    expect(NETWORK_PRESETS[0]).toMatchObject({ id: "mainnet", apiUrl: DEFAULT_API_URL });
    expect(NETWORK_PRESETS[1]).toMatchObject({ id: "testnet", apiUrl: null });
  });

  test("identifies only the bundled mainnet endpoint as mainnet", () => {
    expect(identifyNetworkPreset(`${DEFAULT_API_URL}/`)).toBe("mainnet");
    expect(identifyNetworkPreset(`${DEFAULT_API_URL}/v1/`)).toBe("mainnet");
  });

  test("does not identify arbitrary endpoints as mainnet", () => {
    expect(identifyNetworkPreset("https://api.example/v1")).toBe("custom");
    expect(identifyNetworkPreset("")).toBe("custom");
  });
});
