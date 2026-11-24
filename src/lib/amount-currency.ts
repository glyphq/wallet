import type { DisplayCurrency } from "./format";

export interface AmountCurrencyQuote {
  currency: DisplayCurrency;
  eurUsdRate: number | null;
  btcUsdRate: number | null;
}

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Fiat value of one QUBIC in the configured display currency. */
export function fiatPerQubic(
  priceUsd: number | null | undefined,
  quote: AmountCurrencyQuote,
): number | null {
  if (!finitePositive(priceUsd)) return null;
  if (quote.currency === "USD") return priceUsd;
  const rate = quote.currency === "EUR" ? quote.eurUsdRate : quote.btcUsdRate;
  if (!finitePositive(rate)) return null;
  return priceUsd / rate;
}

export function fiatInputDecimals(currency: DisplayCurrency): number {
  return currency === "BTC" ? 8 : 2;
}

/** Formats a QUBIC amount for a fiat-mode input, trimming trailing zeros. */
export function qubicToFiatInput(
  qubic: string,
  priceUsd: number | null | undefined,
  quote: AmountCurrencyQuote,
): string {
  if (!qubic || !/^\d+$/.test(qubic)) return "";
  const rate = fiatPerQubic(priceUsd, quote);
  if (rate === null) return "";
  const value = Number(qubic) * rate;
  if (!Number.isFinite(value)) return "";
  const formatted = value.toFixed(fiatInputDecimals(quote.currency));
  return formatted.includes(".") ? formatted.replace(/0+$/, "").replace(/\.$/, "") : formatted;
}

/** Converts a fiat-mode input back to an integer QUBIC amount string. */
export function fiatInputToQubic(
  fiat: string,
  priceUsd: number | null | undefined,
  quote: AmountCurrencyQuote,
): string {
  const value = Number(fiat);
  if (!Number.isFinite(value) || value <= 0) return "";
  const rate = fiatPerQubic(priceUsd, quote);
  if (rate === null) return "";
  const qubic = Math.round(value / rate);
  return Number.isFinite(qubic) && qubic > 0 ? String(qubic) : "";
}
