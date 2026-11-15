import type { AppSettings } from "./persisted-types";
import { sanitizeApprovedDapp } from "@/lib/dapp-permissions";
import {
  sanitizeCustomPriceFeedUrl,
  sanitizePollingInterval,
} from "./persisted-sanitizers";

/** Merges persisted settings over defaults and sanitizes every externally-sourced field. */
export function mergeSettings(value: unknown, current: AppSettings): AppSettings {
  const settingsBase =
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...current, ...(value as Partial<AppSettings>) }
      : current;
  const approvedDapps = Array.isArray(settingsBase.approvedDapps)
    ? settingsBase.approvedDapps
        .map(sanitizeApprovedDapp)
        .filter((dapp): dapp is NonNullable<typeof dapp> => dapp !== null)
    : current.approvedDapps;
  return {
    ...settingsBase,
    approvedDapps,
    autoLockMinutes:
      typeof settingsBase.autoLockMinutes === "number" && Number.isInteger(settingsBase.autoLockMinutes)
        ? Math.min(24 * 60, Math.max(1, settingsBase.autoLockMinutes))
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
