import { describe, expect, test } from "bun:test";
import { parseCoinbaseUsdRate } from "@/lib/preferred-currency-quote";

describe("parseCoinbaseUsdRate", () => {
  test("accepts the expected strict Coinbase shape", () => {
    expect(parseCoinbaseUsdRate({ data: { currency: "EUR", rates: { USD: "1.2500" } } }, "EUR")).toBe(1.25);
    expect(parseCoinbaseUsdRate({ data: { currency: "BTC", rates: { USD: "65000" } } }, "BTC")).toBe(65000);
  });

  test("rejects malformed or mismatched quote JSON", () => {
    expect(parseCoinbaseUsdRate({ data: { currency: "EUR", rates: { USD: 1.25 } } }, "EUR")).toBeNull();
    expect(parseCoinbaseUsdRate({ data: { currency: "BTC", rates: { USD: "0" } } }, "BTC")).toBeNull();
    expect(parseCoinbaseUsdRate({ data: { currency: "USD", rates: { EUR: "0.8" } } }, "EUR")).toBeNull();
    expect(parseCoinbaseUsdRate({ data: { currency: "EUR", rates: { USD: "1e2" } } }, "EUR")).toBeNull();
    expect(parseCoinbaseUsdRate(null, "EUR")).toBeNull();
  });
});
