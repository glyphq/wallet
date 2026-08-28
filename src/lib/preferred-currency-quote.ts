export function parseStrictUsdRate(value: unknown): number | null {
  if (typeof value !== "string" || !/^[0-9]+(?:\.[0-9]+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseCoinbaseUsdRate(json: unknown, expectedCurrency: "EUR" | "BTC"): number | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const data = (json as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const currency = (data as { currency?: unknown }).currency;
  const rates = (data as { rates?: unknown }).rates;
  if (currency !== expectedCurrency || !rates || typeof rates !== "object" || Array.isArray(rates)) return null;
  return parseStrictUsdRate((rates as { USD?: unknown }).USD);
}
