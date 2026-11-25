import { isGlobalHttpsUrl, isTrustedPriceFeedUrl } from "@/lib/url-security";

export function sanitizePollingInterval(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(60_000, Math.max(2_000, Math.round(value)))
    : fallback;
}

export function sanitizeNotificationPosition(
  value: unknown,
  fallback: "top-left" | "top-right" | "bottom-left" | "bottom-right"
): "top-left" | "top-right" | "bottom-left" | "bottom-right" {
  return value === "top-left" || value === "top-right" || value === "bottom-right"
    ? value
    : value === "bottom-left"
      ? value
      : fallback;
}

export function sanitizeNotificationDurationSecs(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(30, Math.max(2, Math.round(value)))
    : fallback;
}

export function sanitizeNotificationMaxVisible(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(5, Math.max(1, Math.round(value)))
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
