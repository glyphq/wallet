import { describe, expect, test } from "bun:test";
import { networkIndicator } from "./network-display";

describe("networkIndicator", () => {
  test("keeps the mainnet title bar quiet", () => {
    expect(networkIndicator({ name: "mainnet" })).toBeNull();
  });

  test("makes unresolved and resolved local testnet state unmistakable", () => {
    expect(networkIndicator({ name: "testnet", manifestInstanceId: null })).toEqual({
      label: "LOCAL TESTNET",
      detail: "Local testnet funds have no real value",
      tone: "testnet",
    });
    expect(networkIndicator({
      name: "testnet",
      manifestInstanceId: "12ab34cd-56ef-7890",
    })?.label).toBe("LOCAL TESTNET · 12ab34cd");
    expect(networkIndicator({
      name: "testnet",
      manifestInstanceId: "manifest-unresolved",
    })?.label).toBe("LOCAL TESTNET");
  });

  test("also marks custom networks", () => {
    expect(networkIndicator({ name: "custom" })).toMatchObject({
      label: "CUSTOM NETWORK",
      tone: "custom",
    });
  });
});
