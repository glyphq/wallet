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
import type { ApprovedDapp } from "./persisted-types";
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

export const PERSISTED_STATE_VERSION = 2;

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

export function insertPendingTxForNetwork(
  pendingTxsByNetwork: Record<NetworkScope, PendingTx[]>,
  tx: Omit<PendingTx, "networkScope">,
  expectedScope: NetworkScope
): { pendingTxs: PendingTx[]; pendingTxsByNetwork: Record<NetworkScope, PendingTx[]> } {
  const pendingTxs = [
    { ...tx, networkScope: expectedScope },
    ...(pendingTxsByNetwork[expectedScope] ?? []),
  ].slice(0, MAX_PENDING_TXS);
  return {
    pendingTxs,
    pendingTxsByNetwork: { ...pendingTxsByNetwork, [expectedScope]: pendingTxs },
  };
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

function sanitizeScopedRecordMap<T>(
  value: unknown,
  sanitizeList: (value: unknown, scope: NetworkScope) => T[]
): Record<NetworkScope, T[]> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<NetworkScope, T[]>> = {};
  for (const [scope, records] of Object.entries(value)) {
    if (isNetworkScope(scope)) result[scope] = sanitizeList(records, scope);
  }
  return result as Record<NetworkScope, T[]>;
}

function sanitizeTxMemos(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return clampTxMemos(Object.fromEntries(Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  )));
}

export function sanitizeTxMemosByNetwork(value: unknown): Record<NetworkScope, Record<string, string>> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<NetworkScope, Record<string, string>>> = {};
  for (const [scope, memos] of Object.entries(value)) {
    if (isNetworkScope(scope)) result[scope] = sanitizeTxMemos(memos);
  }
  return result as Record<NetworkScope, Record<string, string>>;
}

function sanitizeTxTags(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([hash, tags]) =>
    Array.isArray(tags)
      ? [[hash, tags.filter((tag): tag is string => typeof tag === "string")]]
      : []
  ));
}

function sanitizeTxTagsByNetwork(value: unknown): Record<NetworkScope, Record<string, string[]>> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<NetworkScope, Record<string, string[]>>> = {};
  for (const [scope, tags] of Object.entries(value)) {
    if (isNetworkScope(scope)) result[scope] = sanitizeTxTags(tags);
  }
  return result as Record<NetworkScope, Record<string, string[]>>;
}

function sanitizePriceSnapshotList(value: unknown): PriceSnapshot[] {
  if (!Array.isArray(value)) return [];
  return clampPriceSnapshots(value.filter((snapshot): snapshot is PriceSnapshot =>
    isRecord(snapshot) && typeof snapshot.timestamp === "number" &&
    Number.isFinite(snapshot.timestamp) && typeof snapshot.priceUsd === "number" &&
    Number.isFinite(snapshot.priceUsd)
  ));
}

function withScope<T extends object>(value: T, networkScope: NetworkScope): T & { networkScope: NetworkScope } {
  return { ...value, networkScope };
}

function sanitizeScheduledTransferList(value: unknown, scope: NetworkScope): ScheduledTransfer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ScheduledTransfer => isRecord(item) && typeof item.id === "string")
    .map((item) => withScope(item, scope)).slice(0, MAX_SCHEDULED_TRANSFERS);
}

function sanitizeNotificationEventList(value: unknown, scope: NetworkScope): NotificationEvent[] {
  if (!Array.isArray(value)) return [];
  return clampNotificationEvents(value.filter((event): event is NotificationEvent =>
    isRecord(event) && typeof event.id === "string" && typeof event.title === "string" &&
    typeof event.body === "string" && typeof event.kind === "string" &&
    typeof event.createdAt === "number" && Number.isFinite(event.createdAt)
  ).map((event) => withScope(event, scope)));
}

function sanitizeRequestHistoryList(value: unknown, scope: NetworkScope): RequestHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return clampRequestHistory(value.filter((event): event is RequestHistoryItem =>
    isRecord(event) && typeof event.id === "string" && typeof event.type === "string" &&
    typeof event.dappName === "string" && typeof event.dappOrigin === "string" &&
    typeof event.action === "string" && typeof event.callbackStatus === "string" &&
    typeof event.createdAt === "number" && Number.isFinite(event.createdAt)
  ).map((event) => withScope(event, scope)));
}

function sanitizeApprovedDappList(value: unknown, scope: NetworkScope): ApprovedDapp[] {
  if (!Array.isArray(value)) return [];
  return value.map((dapp) => sanitizeApprovedDapp(dapp, scope))
    .filter((dapp): dapp is ApprovedDapp => dapp !== null);
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
  if (persistedVersion !== 0 && persistedVersion !== 1) {
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

  // Records written before v2 had no trustworthy chain binding. Assign them
  // deterministically to mainnet, never to the currently configured endpoint.
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
    txMemosByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizeTxMemos(persistedState.txMemos) },
    txTagsByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizeTxTags(persistedState.txTags) },
    scheduledTransfersByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizeScheduledTransferList(persistedState.scheduledTransfers, MAINNET_NETWORK_SCOPE) },
    notificationEventsByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizeNotificationEventList(persistedState.notificationEvents, MAINNET_NETWORK_SCOPE) },
    requestHistoryByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizeRequestHistoryList(persistedState.requestHistory, MAINNET_NETWORK_SCOPE) },
    approvedDappsByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizeApprovedDappList(legacySettings.approvedDapps, MAINNET_NETWORK_SCOPE) },
    priceSnapshotsByNetwork: { [MAINNET_NETWORK_SCOPE]: sanitizePriceSnapshotList(persistedState.priceSnapshots) },
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
  const txMemosByNetwork = ps.txMemosByNetwork !== undefined
    ? sanitizeTxMemosByNetwork(ps.txMemosByNetwork)
    : currentState.txMemosByNetwork;
  const txMemos = txMemosByNetwork[network.scope] ?? {};
  const txTags =
    (ps.txTagsByNetwork !== undefined
      ? sanitizeTxTagsByNetwork(ps.txTagsByNetwork)
      : currentState.txTagsByNetwork)[network.scope] ?? {};
  const txTagsByNetwork = ps.txTagsByNetwork !== undefined
    ? sanitizeTxTagsByNetwork(ps.txTagsByNetwork)
    : currentState.txTagsByNetwork;
  const scheduledTransfersByNetwork = ps.scheduledTransfersByNetwork !== undefined
    ? sanitizeScopedRecordMap(ps.scheduledTransfersByNetwork, sanitizeScheduledTransferList)
    : currentState.scheduledTransfersByNetwork;
  const scheduledTransfers = scheduledTransfersByNetwork[network.scope] ?? [];
  const notificationEventsByNetwork = ps.notificationEventsByNetwork !== undefined
    ? sanitizeScopedRecordMap(ps.notificationEventsByNetwork, sanitizeNotificationEventList)
    : currentState.notificationEventsByNetwork;
  const notificationEvents = notificationEventsByNetwork[network.scope] ?? [];
  const priceSnapshotsByNetwork = ps.priceSnapshotsByNetwork !== undefined
    ? sanitizeScopedRecordMap(ps.priceSnapshotsByNetwork, sanitizePriceSnapshotList)
    : currentState.priceSnapshotsByNetwork;
  const priceSnapshots = priceSnapshotsByNetwork[network.scope] ?? [];
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
  const requestHistoryByNetwork = ps.requestHistoryByNetwork !== undefined
    ? sanitizeScopedRecordMap(ps.requestHistoryByNetwork, sanitizeRequestHistoryList)
    : currentState.requestHistoryByNetwork;
  const requestHistory = requestHistoryByNetwork[network.scope] ?? [];
  const notificationScanAtByNetwork =
    ps.notificationScanAtByNetwork !== undefined
      ? sanitizeNotificationScanAtByNetwork(ps.notificationScanAtByNetwork)
      : currentState.notificationScanAtByNetwork;
  const lastNotificationScanAt = notificationScanAtByNetwork[network.scope] ?? 0;
  const approvedDappsByNetwork = ps.approvedDappsByNetwork !== undefined
    ? sanitizeScopedRecordMap(ps.approvedDappsByNetwork, sanitizeApprovedDappList)
    : currentState.approvedDappsByNetwork;
  const approvedDapps = approvedDappsByNetwork[network.scope] ?? [];
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
    txMemosByNetwork,
    txTags,
    txTagsByNetwork,
    scheduledTransfers,
    scheduledTransfersByNetwork,
    notificationEvents,
    notificationEventsByNetwork,
    priceSnapshots,
    priceSnapshotsByNetwork,
    runtimeIssues,
    auditEvents,
    requestHistory,
    requestHistoryByNetwork,
    approvedDappsByNetwork,
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
