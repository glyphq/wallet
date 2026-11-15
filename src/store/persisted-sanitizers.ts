import { isGlobalHttpsUrl, isTrustedPriceFeedUrl } from "@/lib/url-security";

export function sanitizePollingInterval(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(60_000, Math.max(2_000, Math.round(value)))
    : fallback;
}

export function sanitizeCustomPriceFeedUrl(
  value: unknown,
  fallback: string,
  allowUntrustedForDevelopment = false
): string {
  const isAllowed = (url: string) =>
    isGlobalHttpsUrl(url) &&
    (allowUntrustedForDevelopment || isTrustedPriceFeedUrl(url));
  const safeFallback =
    typeof fallback === "string" && fallback.trim().length <= 2048 && isAllowed(fallback.trim())
      ? fallback.trim()
      : "";
  if (typeof value !== "string") return safeFallback;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 2048 || !isAllowed(trimmed)) return safeFallback;
  return trimmed;
}
