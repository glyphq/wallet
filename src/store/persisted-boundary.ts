import type {
  AccountMeta,
  ApprovedDapp,
  AuditEvent,
  NotificationEvent,
  PersistedState,
  PriceSnapshot,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
  VaultMeta,
} from "./persisted-types";

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

export function mergePersistedState(
  persistedState: unknown,
  currentState: PersistedState
): PersistedState {
  const ps = persistedState as Partial<PersistedState>;
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
  const pendingTxs = Array.isArray(ps.pendingTxs)
    ? ps.pendingTxs
    : currentState.pendingTxs;
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
  const lastNotificationScanAt =
    typeof ps.lastNotificationScanAt === "number"
      ? ps.lastNotificationScanAt
      : currentState.lastNotificationScanAt;
  const settingsBase =
    ps.settings &&
    typeof ps.settings === "object" &&
    !Array.isArray(ps.settings)
      ? { ...currentState.settings, ...ps.settings }
      : currentState.settings;
  const approvedDapps = Array.isArray(settingsBase.approvedDapps)
    ? settingsBase.approvedDapps.filter(
        (dapp): dapp is ApprovedDapp =>
          !!dapp &&
          typeof dapp === "object" &&
          typeof dapp.origin === "string" &&
          typeof dapp.name === "string" &&
          typeof dapp.approvedAt === "number" &&
          Array.isArray(dapp.permissions)
      )
    : currentState.settings.approvedDapps;
  const settings = {
    ...settingsBase,
    approvedDapps,
    highValueSendThreshold:
      typeof settingsBase.highValueSendThreshold === "string"
        ? settingsBase.highValueSendThreshold.replace(/[^\d]/g, "")
        : currentState.settings.highValueSendThreshold,
    lowBalanceThreshold:
      typeof settingsBase.lowBalanceThreshold === "string"
        ? settingsBase.lowBalanceThreshold.replace(/[^\d]/g, "")
        : currentState.settings.lowBalanceThreshold,
    customPriceFeedUrl:
      typeof settingsBase.customPriceFeedUrl === "string"
        ? settingsBase.customPriceFeedUrl
        : currentState.settings.customPriceFeedUrl,
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
    txMemos,
    txTags,
    scheduledTransfers,
    notificationEvents,
    priceSnapshots,
    runtimeIssues,
    auditEvents,
    requestHistory,
    lastNotificationScanAt,
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
