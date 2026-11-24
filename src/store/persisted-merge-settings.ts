import type { AppSettings, NetworkConfig } from "./persisted-types";
import { DEFAULT_API_URL, normalizeApiUrl } from "@/lib/api-url";
import {
  sanitizeCustomPriceFeedUrl,
  sanitizePollingInterval,
} from "./persisted-sanitizers";

function sanitizeNetworkConfig(value: unknown, current: NetworkConfig): NetworkConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return current;
  const record = value as { apiUrl?: unknown };
  const apiUrl = typeof record.apiUrl === "string" ? normalizeApiUrl(record.apiUrl) : null;
  // Legacy settings stored live/query RPC URLs and no Glyph API URL. Those
  // endpoints are no longer used, so fall back to the bundled mainnet API.
  if (!apiUrl) return current;
  return {
    apiUrl,
    name: apiUrl === DEFAULT_API_URL ? "mainnet" : "custom",
  };
}

/** Merges persisted settings over defaults and sanitizes every externally-sourced field. */
export function mergeSettings(value: unknown, current: AppSettings): AppSettings {
  const settingsBase =
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...current, ...(value as Partial<AppSettings>) }
      : current;
  return {
    ...settingsBase,
    network: sanitizeNetworkConfig(settingsBase.network, current.network),
    autoLockMinutes:
      typeof settingsBase.autoLockMinutes === "number" && Number.isInteger(settingsBase.autoLockMinutes)
        ? Math.min(24 * 60, Math.max(0, settingsBase.autoLockMinutes))
        : current.autoLockMinutes,
    highValueSendThreshold:
      typeof settingsBase.highValueSendThreshold === "string"
        ? settingsBase.highValueSendThreshold.replace(/[^\d]/g, "")
        : current.highValueSendThreshold,
    lowBalanceThreshold:
      typeof settingsBase.lowBalanceThreshold === "string"
        ? settingsBase.lowBalanceThreshold.replace(/[^\d]/g, "")
        : current.lowBalanceThreshold,
    customPriceFeedUrl: sanitizeCustomPriceFeedUrl(
      settingsBase.customPriceFeedUrl,
      current.customPriceFeedUrl,
      import.meta.env.DEV === true
    ),
    largeIncomingThreshold:
      typeof settingsBase.largeIncomingThreshold === "string"
        ? settingsBase.largeIncomingThreshold.replace(/[^\d]/g, "")
        : current.largeIncomingThreshold,
    priceAlertAbove:
      typeof settingsBase.priceAlertAbove === "string"
        ? settingsBase.priceAlertAbove.replace(/[^\d.]/g, "")
        : current.priceAlertAbove,
    priceAlertBelow:
      typeof settingsBase.priceAlertBelow === "string"
        ? settingsBase.priceAlertBelow.replace(/[^\d.]/g, "")
        : current.priceAlertBelow,
    pollingIntervalActiveMs: sanitizePollingInterval(
      settingsBase.pollingIntervalActiveMs,
      current.pollingIntervalActiveMs
    ),
    pollingIntervalBackgroundMs: sanitizePollingInterval(
      settingsBase.pollingIntervalBackgroundMs,
      current.pollingIntervalBackgroundMs
    ),
    pollingIntervalTrayMs: sanitizePollingInterval(
      settingsBase.pollingIntervalTrayMs,
      current.pollingIntervalTrayMs
    ),
    pollingIntervalLockedMs: sanitizePollingInterval(
      settingsBase.pollingIntervalLockedMs,
      current.pollingIntervalLockedMs
    ),
    sponsorAttribution:
      settingsBase.sponsorAttribution === "identity" ||
      settingsBase.sponsorAttribution === "custom"
        ? settingsBase.sponsorAttribution
        : current.sponsorAttribution,
    allowBlurLockBypass: !!settingsBase.allowBlurLockBypass,
  };
}
