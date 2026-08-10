import { describe, expect, test } from "bun:test";
import { formatPreferredCurrencyFromQu, formatQuCompact, formatUsdFromQu } from "@/lib/format";

describe("formatQuCompact", () => {
  test("keeps bigint values exact around compact thresholds", () => {
    expect(formatQuCompact(999n)).toBe("999");
    expect(formatQuCompact(1_500n)).toBe("1.5K");
    expect(formatQuCompact(1_250_000n)).toBe("1.25M");
    expect(formatQuCompact(9_876_543_210n)).toBe("9.87B");
  });

  test("preserves sign for negative values", () => {
    expect(formatQuCompact(-1_500n)).toBe("-1.5K");
  });
});

describe("formatUsdFromQu", () => {
  test("formats bigint balances without passing through unsafe numbers", () => {
    expect(formatUsdFromQu(12_345_678_901_234_567n, 0.01)).toBe("123,456,789,012,345.67");
  });

  test("rejects invalid prices", () => {
    expect(formatUsdFromQu(100n, Number.NaN)).toBe("—");
  });
});

describe("formatPreferredCurrencyFromQu", () => {
  test("honors USD preference using existing latest-stats price", () => {
    expect(formatPreferredCurrencyFromQu(12_345n, { currency: "USD", usdPrice: 0.01 })).toEqual({
      currency: "USD",
      value: "123.45",
      available: true,
      text: "≈ $123.45",
    });
  });

  test("converts EUR only when a real USD/EUR market rate is provided", () => {
    expect(formatPreferredCurrencyFromQu(110_000n, { currency: "EUR", usdPrice: 0.01 }).available).toBe(false);
    expect(formatPreferredCurrencyFromQu(110_000n, { currency: "EUR", usdPrice: 0.01, eurUsdRate: 1.1 })).toEqual({
      currency: "EUR",
      value: "1,000.00",
      available: true,
      text: "≈ €1,000.00",
    });
  });

  test("converts BTC only when a real USD/BTC market rate is provided", () => {
    expect(formatPreferredCurrencyFromQu(1_000_000n, { currency: "BTC", usdPrice: 0.01 }).text).toBe("—");
    expect(formatPreferredCurrencyFromQu(1_000_000n, { currency: "BTC", usdPrice: 0.01, btcUsdRate: 50_000 })).toEqual({
      currency: "BTC",
      value: "0.20000000",
      available: true,
      text: "≈ ₿0.20000000",
    });
  });
});
