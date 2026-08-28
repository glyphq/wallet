import type {
  AccountMeta,
  AuditEvent,
  NotificationEvent,
  PendingTx,
  PersistedState,
  PriceSnapshot,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
  VaultMeta,
} from "./persisted-types";
import type { NetworkScope } from "@/lib/network-config";
import { isGlobalHttpsUrl } from "@/lib/url-security";
import { sanitizeApprovedDapp } from "@/lib/dapp-permissions";
import {
  MAINNET_NETWORK_CONFIG,
  MAINNET_NETWORK_SCOPE,
  isNetworkScope,
  parsePersistedNetworkConfig,
  resolveNetworkConfig,
} from "@/lib/network-config";

export const PERSISTED_STATE_VERSION = 1;

export const MAX_PENDING_TXS = 50;
export const MAX_TX_MEMOS = 500;
export const MAX_SCHEDULED_TRANSFERS = 50;
export const MAX_NOTIFICATION_EVENTS = 200;
export const MAX_AUDIT_EVENTS = 500;
export const MAX_REQUEST_HISTORY = 200;
export const MAX_PRICE_SNAPSHOTS = 2_000;
export const MAX_RUNTIME_ISSUES = 100;

export function clampTxMemos(
  txMemos: Record<string, string>
): Record<string, string> {
  const entries = Object.entries(txMemos);
  if (entries.length <= MAX_TX_MEMOS) return txMemos;
  return Object.fromEntries(entries.slice(entries.length - MAX_TX_MEMOS));
}

export function clampNotificationEvents(
  events: NotificationEvent[]
): NotificationEvent[] {
  if (events.length <= MAX_NOTIFICATION_EVENTS) return events;
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_NOTIFICATION_EVENTS);
}

export function clampAuditEvents(events: AuditEvent[]): AuditEvent[] {
  if (events.length <= MAX_AUDIT_EVENTS) return events;
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_AUDIT_EVENTS);
}

export function clampRequestHistory(
  events: RequestHistoryItem[]
): RequestHistoryItem[] {
  if (events.length <= MAX_REQUEST_HISTORY) return events;
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_REQUEST_HISTORY);
}

export function clampPriceSnapshots(
  snapshots: PriceSnapshot[]
): PriceSnapshot[] {
  if (snapshots.length <= MAX_PRICE_SNAPSHOTS) return snapshots;
  return snapshots
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_PRICE_SNAPSHOTS);
}

export function clampRuntimeIssues(issues: RuntimeIssue[]): RuntimeIssue[] {
  if (issues.length <= MAX_RUNTIME_ISSUES) return issues;
  return issues
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_RUNTIME_ISSUES);
}

export function sanitizePollingInterval(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(60_000, Math.max(2_000, Math.round(value)))
    : fallback;
}

export function sanitizeCustomPriceFeedUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 2048 || !isGlobalHttpsUrl(trimmed)) return fallback;
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizePendingTx(value: unknown, networkScope: NetworkScope): PendingTx | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.hash !== "string" ||
    typeof value.source !== "string" ||
    typeof value.destination !== "string" ||
    typeof value.amount !== "string" ||
    typeof value.targetTick !== "number" ||
    !Number.isFinite(value.targetTick) ||
    typeof value.broadcastAt !== "number" ||
    !Number.isFinite(value.broadcastAt)
  ) {
    return null;
  }
  return {
    hash: value.hash,
    source: value.source,
    destination: value.destination,
    amount: value.amount,
    targetTick: value.targetTick,
    broadcastAt: value.broadcastAt,
    networkScope,
    ...(typeof value.contractName === "string"
      ? { contractName: value.contractName }
      : {}),
  };
}

function sanitizePendingTxList(
  value: unknown,
  networkScope: NetworkScope
): PendingTx[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tx) => sanitizePendingTx(tx, networkScope))
    .filter((tx): tx is PendingTx => tx !== null)
    .slice(0, MAX_PENDING_TXS);
}

export function sanitizePendingTxsByNetwork(
  value: unknown
): Record<NetworkScope, PendingTx[]> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<NetworkScope, PendingTx[]>> = {};
  for (const [scope, transactions] of Object.entries(value)) {
    if (!isNetworkScope(scope)) continue;
    result[scope] = sanitizePendingTxList(transactions, scope);
  }
  return result as Record<NetworkScope, PendingTx[]>;
}

export function sanitizeNotificationScanAtByNetwork(
  value: unknown
): Record<NetworkScope, number> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<NetworkScope, number>> = {};
  for (const [scope, timestamp] of Object.entries(value)) {
    if (
      isNetworkScope(scope) &&
      typeof timestamp === "number" &&
      Number.isFinite(timestamp) &&
      timestamp >= 0
    ) {
      result[scope] = timestamp;
    }
  }
  return result as Record<NetworkScope, number>;
}

/**
 * Explicit persistence migration. Unknown versions and invalid legacy network
 * endpoints throw so hydration cannot silently switch the wallet to mainnet.
 */
export function migratePersistedState(
  persistedState: unknown,
  persistedVersion: number
): unknown {
  if (persistedVersion === PERSISTED_STATE_VERSION) return persistedState;
  if (persistedVersion !== 0) {
    throw new Error(`Unsupported persisted state version: ${persistedVersion}`);
  }
  if (!isRecord(persistedState)) {
    throw new Error("Persisted state must be an object");
  }

  if (
    persistedState.settings !== undefined &&
    !isRecord(persistedState.settings)
  ) {
    throw new Error("Persisted legacy settings are invalid");
  }
  const legacySettings = isRecord(persistedState.settings)
    ? persistedState.settings
    : {};
  const legacyNetwork = legacySettings.network;
  const network =
    legacyNetwork === undefined
      ? MAINNET_NETWORK_CONFIG
      : isRecord(legacyNetwork)
        ? resolveNetworkConfig({
            liveApiUrl: legacyNetwork.liveApiUrl,
            queryApiUrl: legacyNetwork.queryApiUrl,
            manifestInstanceId: legacyNetwork.manifestInstanceId,
          })
        : (() => {
            throw new Error("Persisted legacy network configuration is invalid");
          })();

  // Pre-versioned chain-derived records all originated from the mainnet-only
  // wallet. Preserve that fact even if an old custom endpoint setting existed.
  const pendingTxs = sanitizePendingTxList(
    persistedState.pendingTxs,
    MAINNET_NETWORK_SCOPE
  );
  const lastNotificationScanAt =
    typeof persistedState.lastNotificationScanAt === "number" &&
    Number.isFinite(persistedState.lastNotificationScanAt) &&
    persistedState.lastNotificationScanAt >= 0
      ? persistedState.lastNotificationScanAt
      : 0;

  return {
    ...persistedState,
    settings: { ...legacySettings, network },
    pendingTxs,
    pendingTxsByNetwork: { [MAINNET_NETWORK_SCOPE]: pendingTxs },
    lastNotificationScanAt,
    notificationScanAtByNetwork: {
      [MAINNET_NETWORK_SCOPE]: lastNotificationScanAt,
    },
  };
}

export function mergePersistedState(
  persistedState: unknown,
  currentState: PersistedState
): PersistedState {
  if (!isRecord(persistedState)) {
    throw new Error("Persisted state must be an object");
  }
  const ps = persistedState as Partial<PersistedState>;
  if (ps.settings !== undefined && !isRecord(ps.settings)) {
    throw new Error("Persisted settings are invalid");
  }
  const persistedSettings = isRecord(ps.settings) ? ps.settings : null;
  const network =
    persistedSettings && "network" in persistedSettings
      ? parsePersistedNetworkConfig(persistedSettings.network)
      : currentState.settings.network;
  const settingsBase = persistedSettings
    ? { ...currentState.settings, ...persistedSettings, network }
    : currentState.settings;
  const vaults = Array.isArray(ps.vaults)
    ? ps.vaults
        .filter(
          (vault): vault is VaultMeta => !!vault && typeof vault === "object"
        )
        .map(
          (vault): VaultMeta => ({
            ...vault,
            kind: "seeded",
            encryptedData: vault.encryptedData ?? null,
            accounts: Array.isArray(vault.accounts)
              ? vault.accounts
                  .filter(
                    (account): account is AccountMeta =>
                      !!account && typeof account === "object"
                  )
                  .map((account) => ({
                    ...account,
                    note: typeof account.note === "string" ? account.note : "",
                    tags: Array.isArray(account.tags)
                      ? account.tags.filter(
                          (tag): tag is string => typeof tag === "string"
                        )
                      : [],
                    identity:
                      typeof account.identity === "string"
                        ? account.identity
                        : undefined,
                  }))
              : [],
          })
        )
    : currentState.vaults;
  const contacts = Array.isArray(ps.contacts)
    ? ps.contacts
    : currentState.contacts;
  const pendingTxsByNetwork =
    ps.pendingTxsByNetwork !== undefined
      ? sanitizePendingTxsByNetwork(ps.pendingTxsByNetwork)
      : currentState.pendingTxsByNetwork;
  const pendingTxs = pendingTxsByNetwork[network.scope] ?? [];
  const txMemos =
    ps.txMemos && typeof ps.txMemos === "object" && !Array.isArray(ps.txMemos)
      ? clampTxMemos(ps.txMemos as Record<string, string>)
      : currentState.txMemos;
  const txTags =
    ps.txTags && typeof ps.txTags === "object" && !Array.isArray(ps.txTags)
      ? (ps.txTags as Record<string, string[]>)
      : currentState.txTags;
  const scheduledTransfers = Array.isArray(ps.scheduledTransfers)
    ? (ps.scheduledTransfers as ScheduledTransfer[]).filter(
        (t) => t && typeof t.id === "string"
      )
    : currentState.scheduledTransfers;
  const notificationEvents = Array.isArray(ps.notificationEvents)
    ? clampNotificationEvents(
        ps.notificationEvents.filter(
          (event): event is NotificationEvent =>
            !!event &&
            typeof event === "object" &&
            typeof event.id === "string" &&
            typeof event.title === "string" &&
            typeof event.body === "string" &&
            typeof event.kind === "string" &&
            typeof event.createdAt === "number"
        )
      )
    : currentState.notificationEvents;
  const priceSnapshots = Array.isArray(ps.priceSnapshots)
    ? clampPriceSnapshots(
        ps.priceSnapshots.filter(
          (snapshot): snapshot is PriceSnapshot =>
            !!snapshot &&
            typeof snapshot === "object" &&
            typeof snapshot.timestamp === "number" &&
            typeof snapshot.priceUsd === "number" &&
            Number.isFinite(snapshot.priceUsd)
        )
      )
    : currentState.priceSnapshots;
  const runtimeIssues = Array.isArray(ps.runtimeIssues)
    ? clampRuntimeIssues(
        ps.runtimeIssues.filter(
          (issue): issue is RuntimeIssue =>
            !!issue &&
            typeof issue === "object" &&
            typeof issue.id === "string" &&
            typeof issue.source === "string" &&
            typeof issue.title === "string" &&
            typeof issue.detail === "string" &&
            typeof issue.createdAt === "number"
        )
      )
    : currentState.runtimeIssues;
  const auditEvents = Array.isArray(ps.auditEvents)
    ? clampAuditEvents(
        ps.auditEvents.filter(
          (event): event is AuditEvent =>
            !!event &&
            typeof event === "object" &&
            typeof event.id === "string" &&
            typeof event.kind === "string" &&
            typeof event.title === "string" &&
            typeof event.detail === "string" &&
            typeof event.createdAt === "number"
        )
      )
    : currentState.auditEvents;
  const requestHistory = Array.isArray(ps.requestHistory)
    ? clampRequestHistory(
        ps.requestHistory.filter(
          (event): event is RequestHistoryItem =>
            !!event &&
            typeof event === "object" &&
            typeof event.id === "string" &&
            typeof event.type === "string" &&
            typeof event.dappName === "string" &&
            typeof event.dappOrigin === "string" &&
            typeof event.action === "string" &&
            typeof event.callbackStatus === "string" &&
            typeof event.createdAt === "number"
        )
      )
    : currentState.requestHistory;
  const notificationScanAtByNetwork =
    ps.notificationScanAtByNetwork !== undefined
      ? sanitizeNotificationScanAtByNetwork(ps.notificationScanAtByNetwork)
      : currentState.notificationScanAtByNetwork;
  const lastNotificationScanAt = notificationScanAtByNetwork[network.scope] ?? 0;
  const approvedDapps = Array.isArray(settingsBase.approvedDapps)
    ? settingsBase.approvedDapps
        .map(sanitizeApprovedDapp)
        .filter((dapp): dapp is NonNullable<typeof dapp> => dapp !== null)
    : currentState.settings.approvedDapps;
  const settings = {
    ...settingsBase,
    approvedDapps,
    autoLockMinutes:
      typeof settingsBase.autoLockMinutes === "number" && Number.isInteger(settingsBase.autoLockMinutes)
        ? Math.min(24 * 60, Math.max(1, settingsBase.autoLockMinutes))
        : currentState.settings.autoLockMinutes,
    highValueSendThreshold:
      typeof settingsBase.highValueSendThreshold === "string"
        ? settingsBase.highValueSendThreshold.replace(/[^\d]/g, "")
        : currentState.settings.highValueSendThreshold,
    lowBalanceThreshold:
      typeof settingsBase.lowBalanceThreshold === "string"
        ? settingsBase.lowBalanceThreshold.replace(/[^\d]/g, "")
        : currentState.settings.lowBalanceThreshold,
    customPriceFeedUrl: sanitizeCustomPriceFeedUrl(
      settingsBase.customPriceFeedUrl,
      currentState.settings.customPriceFeedUrl
    ),
    largeIncomingThreshold:
      typeof settingsBase.largeIncomingThreshold === "string"
        ? settingsBase.largeIncomingThreshold.replace(/[^\d]/g, "")
        : currentState.settings.largeIncomingThreshold,
    priceAlertAbove:
      typeof settingsBase.priceAlertAbove === "string"
        ? settingsBase.priceAlertAbove.replace(/[^\d.]/g, "")
        : currentState.settings.priceAlertAbove,
    priceAlertBelow:
      typeof settingsBase.priceAlertBelow === "string"
        ? settingsBase.priceAlertBelow.replace(/[^\d.]/g, "")
        : currentState.settings.priceAlertBelow,
    pollingIntervalActiveMs: sanitizePollingInterval(
      settingsBase.pollingIntervalActiveMs,
      currentState.settings.pollingIntervalActiveMs
    ),
    pollingIntervalBackgroundMs: sanitizePollingInterval(
      settingsBase.pollingIntervalBackgroundMs,
      currentState.settings.pollingIntervalBackgroundMs
    ),
    pollingIntervalTrayMs: sanitizePollingInterval(
      settingsBase.pollingIntervalTrayMs,
      currentState.settings.pollingIntervalTrayMs
    ),
    pollingIntervalLockedMs: sanitizePollingInterval(
      settingsBase.pollingIntervalLockedMs,
      currentState.settings.pollingIntervalLockedMs
    ),
    sponsorAttribution:
      settingsBase.sponsorAttribution === "identity" ||
      settingsBase.sponsorAttribution === "custom"
        ? settingsBase.sponsorAttribution
        : currentState.settings.sponsorAttribution,
    allowBlurLockBypass: !!settingsBase.allowBlurLockBypass,
  };
  return {
    ...currentState,
    vaults,
    contacts,
    pendingTxs,
    pendingTxsByNetwork,
    txMemos,
    txTags,
    scheduledTransfers,
    notificationEvents,
    priceSnapshots,
    runtimeIssues,
    auditEvents,
    requestHistory,
    lastNotificationScanAt,
    notificationScanAtByNetwork,
    passwordAttempts:
      typeof ps.passwordAttempts === "number" && Number.isInteger(ps.passwordAttempts)
        ? Math.min(10, Math.max(0, ps.passwordAttempts))
        : currentState.passwordAttempts,
    passwordLockoutUntil:
      typeof ps.passwordLockoutUntil === "number" ? ps.passwordLockoutUntil : 0,
    exportSigningKey:
      ps.exportSigningKey && typeof ps.exportSigningKey === "object" && !Array.isArray(ps.exportSigningKey)
        ? ps.exportSigningKey
        : currentState.exportSigningKey,
    settings,
  };
}
