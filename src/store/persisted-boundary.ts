import type { PersistedState } from "./persisted-types";
import { mergeVaults } from "./persisted-merge-vaults";
import {
  mergeContacts,
  mergePendingTxs,
  mergeScheduledTransfers,
  mergeTxMemos,
  mergeTxTags,
} from "./persisted-merge-collections";
import {
  mergeAuditEvents,
  mergeNotificationEvents,
  mergePriceSnapshots,
  mergeRequestHistory,
  mergeRuntimeIssues,
} from "./persisted-merge-events";
import { mergeSettings } from "./persisted-merge-settings";

export {
  MAX_ACCOUNTS_PER_VAULT,
  MAX_NOTIFICATION_EVENTS,
  MAX_PENDING_TXS,
  MAX_SCHEDULED_TRANSFERS,
  MAX_TX_MEMOS,
} from "./persisted-limits";
export {
  clampNotificationEvents,
  clampTxMemos,
} from "./persisted-clamps";
export {
  sanitizeCustomPriceFeedUrl,
  sanitizePollingInterval,
} from "./persisted-sanitizers";

/** Validates and clamps persisted state before it replaces the in-memory store. */
export function mergePersistedState(
  persistedState: unknown,
  currentState: PersistedState
): PersistedState {
  const ps: Partial<PersistedState> =
    persistedState && typeof persistedState === "object" && !Array.isArray(persistedState)
      ? persistedState as Partial<PersistedState>
      : {};
  return {
    ...currentState,
    vaults: mergeVaults(ps.vaults, currentState.vaults),
    contacts: mergeContacts(ps.contacts, currentState.contacts),
    pendingTxs: mergePendingTxs(ps.pendingTxs, currentState.pendingTxs),
    txMemos: mergeTxMemos(ps.txMemos, currentState.txMemos),
    txTags: mergeTxTags(ps.txTags, currentState.txTags),
    scheduledTransfers: mergeScheduledTransfers(
      ps.scheduledTransfers,
      currentState.scheduledTransfers
    ),
    notificationEvents: mergeNotificationEvents(
      ps.notificationEvents,
      currentState.notificationEvents
    ),
    priceSnapshots: mergePriceSnapshots(
      ps.priceSnapshots,
      currentState.priceSnapshots
    ),
    runtimeIssues: mergeRuntimeIssues(
      ps.runtimeIssues,
      currentState.runtimeIssues
    ),
    auditEvents: mergeAuditEvents(ps.auditEvents, currentState.auditEvents),
    requestHistory: mergeRequestHistory(
      ps.requestHistory,
      currentState.requestHistory
    ),
    lastNotificationScanAt:
      typeof ps.lastNotificationScanAt === "number"
        ? ps.lastNotificationScanAt
        : currentState.lastNotificationScanAt,
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
    settings: mergeSettings(ps.settings, currentState.settings),
  };
}
