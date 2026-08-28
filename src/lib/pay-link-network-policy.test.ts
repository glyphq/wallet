import { describe, expect, test } from "bun:test";
import { canUseLegacyPayLinks } from "./pay-link-network-policy";

describe("legacy payment-link network policy", () => {
  test("allows the established unbound format only on mainnet", () => {
    expect(canUseLegacyPayLinks("mainnet")).toBe(true);
    expect(canUseLegacyPayLinks("testnet")).toBe(false);
    expect(canUseLegacyPayLinks("custom")).toBe(false);
  });
});
