import { describe, expect, test } from "bun:test";
import { buildStatsUrl, resolveLatestStatsUrl } from "./latest-stats-policy";

describe("latest network statistics policy", () => {
  test("derives the official statistics endpoint from a mainnet live API", () => {
    expect(buildStatsUrl("https://rpc.qubic.org/live/v1")).toBe(
      "https://rpc.qubic.org/v1/latest-stats",
    );
    expect(resolveLatestStatsUrl({
      name: "mainnet",
      liveApiUrl: "https://rpc.qubic.org/live/v1",
    }, "")).toBe("https://rpc.qubic.org/v1/latest-stats");
  });

  test("allows an explicit price feed for non-testnet custom networks", () => {
    expect(resolveLatestStatsUrl({
      name: "custom",
      liveApiUrl: "https://rpc.example/live/v1",
    }, "https://prices.example/latest")).toBe("https://prices.example/latest");
  });

  test("never assigns a fiat market feed to local testnet QU", () => {
    const local = {
      name: "testnet" as const,
      liveApiUrl: "http://127.0.0.1:41841/live/v1",
    };

    expect(resolveLatestStatsUrl(local, "")).toBeNull();
    expect(resolveLatestStatsUrl(local, "https://prices.example/latest")).toBeNull();
  });
});
