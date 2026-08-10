/** Shorten a Qubic identity or hash for display. head + tail chars, separated by "…". */
export function truncateId(id: string, head = 8, tail = 8): string {
  const chars = Array.from(id);
  if (!id || chars.length <= head + tail) return id;
  return `${chars.slice(0, head).join("")}…${chars.slice(-tail).join("")}`;
}

/** Extracts a human-readable message from an unknown thrown value. */
export function extractMessage(e: unknown, fallback = "An error occurred."): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

/** Format a QU amount (bigint, string, or number) with comma-separated thousands. */
export function formatQu(amount: bigint | string | number): string {
  try {
    const n = typeof amount === "number" ? BigInt(Math.round(amount)) : BigInt(amount);
    const sign = n < 0n ? "-" : "";
    const abs = n < 0n ? (-n).toString() : n.toString();
    const withCommas = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + withCommas;
  } catch { return "—"; }
}

function formatCompactFraction(value: bigint, divisor: bigint, decimals: number): string {
  const whole = value / divisor;
  if (decimals === 0) return whole.toString();

  const scale = 10n ** BigInt(decimals);
  const fraction = ((value % divisor) * scale) / divisor;
  const trimmed = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/** Compact QU format for list rows — 1K / 1.2M / 3.4B. Full precision below 1 000. */
export function formatQuCompact(amount: bigint | string | number): string {
  try {
    const raw = typeof amount === "number" ? BigInt(Math.round(amount)) : BigInt(amount);
    const sign = raw < 0n ? "-" : "";
    const n = raw < 0n ? -raw : raw;
    if (n >= 1_000_000_000n) return `${sign}${formatCompactFraction(n, 1_000_000_000n, 2)}B`;
    if (n >= 1_000_000n) return `${sign}${formatCompactFraction(n, 1_000_000n, 2)}M`;
    if (n >= 1_000n) return `${sign}${formatCompactFraction(n, 1_000n, 1)}K`;
    return `${sign}${n.toLocaleString()}`;
  } catch { return "—"; }
}

export function formatUsdFromQu(amount: bigint | string | number, price: number): string {
  try {
    if (!Number.isFinite(price) || price < 0) return "—";
    const qu = typeof amount === "number" ? BigInt(Math.round(amount)) : BigInt(amount);
    const [coefficient, exponentText = "0"] = price.toString().toLowerCase().split("e");
    const [whole, fraction = ""] = coefficient.split(".");
    const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
    const exponent = Number(exponentText) - fraction.length;
    const priceNumerator = BigInt(digits || "0") * (exponent > 0 ? 10n ** BigInt(exponent) : 1n);
    const priceDenominator = exponent < 0 ? 10n ** BigInt(-exponent) : 1n;
    const usdNumerator = qu * priceNumerator;
    const sign = usdNumerator < 0n ? "-" : "";
    const absoluteNumerator = usdNumerator < 0n ? -usdNumerator : usdNumerator;
    const decimals = absoluteNumerator < priceDenominator ? 4 : 2;
    const decimalScale = 10n ** BigInt(decimals);
    const rounded = (absoluteNumerator * decimalScale + priceDenominator / 2n) / priceDenominator;
    const usdWhole = rounded / decimalScale;
    const usdFraction = (rounded % decimalScale).toString().padStart(decimals, "0");
    const groupedWhole = usdWhole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}${groupedWhole}.${usdFraction}`;
  } catch { return "—"; }
}

export type DisplayCurrency = "USD" | "EUR" | "BTC";

export interface PreferredCurrencyPriceInput {
  /** Preferred display currency from persisted settings. */
  currency: DisplayCurrency;
  /** Existing latest-stats price: USD per QU. */
  usdPrice: number | null | undefined;
  /** Optional market data only. USD per EUR. Do not synthesize. */
  eurUsdRate?: number | null;
  /** Optional market data only. USD per BTC. Do not synthesize. */
  btcUsdRate?: number | null;
}

export interface PreferredCurrencyPrice {
  currency: DisplayCurrency;
  value: string;
  available: boolean;
  text: string;
}

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatDecimalFromRatio(numerator: bigint, denominator: bigint, decimals: number): string {
  const sign = numerator < 0n ? "-" : "";
  const absolute = numerator < 0n ? -numerator : numerator;
  const scale = 10n ** BigInt(decimals);
  const rounded = (absolute * scale + denominator / 2n) / denominator;
  const whole = rounded / scale;
  const fraction = (rounded % scale).toString().padStart(decimals, "0");
  const groupedWhole = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${groupedWhole}.${fraction}`;
}

function numberToRatio(value: number | null | undefined): { numerator: bigint; denominator: bigint } | null {
  if (!finitePositive(value)) return null;
  const [coefficient, exponentText = "0"] = value.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const exponent = Number(exponentText) - fraction.length;
  return {
    numerator: BigInt(digits || "0") * (exponent > 0 ? 10n ** BigInt(exponent) : 1n),
    denominator: exponent < 0 ? 10n ** BigInt(-exponent) : 1n,
  };
}

export function formatPreferredCurrencyFromQu(
  amount: bigint | string | number,
  input: PreferredCurrencyPriceInput,
): PreferredCurrencyPrice {
  try {
    const qu = typeof amount === "number" ? BigInt(Math.round(amount)) : BigInt(amount);
    const usdRatio = numberToRatio(input.usdPrice ?? null);
    if (!usdRatio) return { currency: input.currency, value: "—", available: false, text: "—" };

    if (input.currency === "USD") {
      const value = formatUsdFromQu(qu, input.usdPrice ?? Number.NaN);
      return { currency: "USD", value, available: value !== "—", text: value === "—" ? "—" : `≈ $${value}` };
    }

    const quoteRate = input.currency === "EUR" ? input.eurUsdRate : input.btcUsdRate;
    const quoteRatio = numberToRatio(quoteRate ?? null);
    if (!quoteRatio) return { currency: input.currency, value: "—", available: false, text: "—" };

    const numerator = qu * usdRatio.numerator * quoteRatio.denominator;
    const denominator = usdRatio.denominator * quoteRatio.numerator;
    const decimals = input.currency === "BTC" ? 8 : 2;
    const value = formatDecimalFromRatio(numerator, denominator, decimals);
    const prefix = input.currency === "EUR" ? "€" : "₿";
    return { currency: input.currency, value, available: true, text: `≈ ${prefix}${value}` };
  } catch {
    return { currency: input.currency, value: "—", available: false, text: "—" };
  }
}

/** Human-readable relative time. "Just now" / "5m ago" / "3h ago" / "2d ago". */
export function timeAgo(ms: number): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Format a Unix-ms timestamp as locale date+time, e.g. "May 21, 14:32". */
export function formatDate(timestampMs: number | null | undefined): string {
  if (!timestampMs) return "";
  try {
    return new Date(timestampMs).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch { return ""; }
}
