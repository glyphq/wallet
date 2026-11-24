import { describe, expect, test } from "bun:test";
import { fiatInputToQubic, qubicToFiatInput } from "./amount-currency";

const usd = { currency: "USD" as const, eurUsdRate: null, btcUsdRate: null };
const eur = { currency: "EUR" as const, eurUsdRate: 1.1, btcUsdRate: null };

describe("amount currency conversion", () => {
  test("converts QUBIC to fiat input", () => {
    expect(qubicToFiatInput("1000", 0.5, usd)).toBe("500");
    expect(qubicToFiatInput("1000", 0.5, eur)).toBe("454.55");
  });

  test("converts fiat input back to QUBIC", () => {
    expect(fiatInputToQubic("500", 0.5, usd)).toBe("1000");
    expect(fiatInputToQubic("454.55", 0.5, eur)).toBe("1000");
  });

  test("returns empty values when price data is unavailable", () => {
    expect(qubicToFiatInput("1000", null, usd)).toBe("");
    expect(fiatInputToQubic("500", null, usd)).toBe("");
  });
});
