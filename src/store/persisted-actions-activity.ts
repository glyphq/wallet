import type { PersistedStoreSet } from "./persisted-store-set";
import type {
  AuditEvent,
  NotificationEvent,
  PendingTx,
  PriceSnapshot,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
} from "./persisted-types";
import {
  MAX_PENDING_TXS,
  MAX_SCHEDULED_TRANSFERS,
} from "./persisted-limits";
import {
  clampAuditEvents,
  clampNotificationEvents,
  clampPriceSnapshots,
  clampRequestHistory,
  clampRuntimeIssues,
  clampTxMemos,
} from "./persisted-clamps";

/** Activity, notification, audit and request-history actions for the persisted store. */
export function createActivityActions(set: PersistedStoreSet) {
  return {
    addPendingTx: (tx: PendingTx) =>
      set((s) => ({
        pendingTxs: [tx, ...s.pendingTxs].slice(0, MAX_PENDING_TXS),
      })),

    removePendingTx: (hash: string) =>
      set((s) => ({
        pendingTxs: s.pendingTxs.filter((t) => t.hash !== hash),
      })),

    setTxMemo: (hash: string, memo: string) =>
      set((s) => ({ txMemos: clampTxMemos({ ...s.txMemos, [hash]: memo }) })),

    deleteTxMemo: (hash: string) =>
      set((s) => {
        const next = { ...s.txMemos };
        delete next[hash];
        return { txMemos: next };
      }),

    addScheduledTransfer: (transfer: ScheduledTransfer) =>
      set((s) => ({
        scheduledTransfers: [transfer, ...s.scheduledTransfers].slice(
          0,
          MAX_SCHEDULED_TRANSFERS
        ),
      })),

    updateScheduledTransfer: (
      id: string,
      updates: Partial<Omit<ScheduledTransfer, "id" | "createdAt">>
    ) =>
      set((s) => ({
        scheduledTransfers: s.scheduledTransfers.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),

    removeScheduledTransfer: (id: string) =>
      set((s) => ({
        scheduledTransfers: s.scheduledTransfers.filter((t) => t.id !== id),
      })),

    addNotificationEvent: (event: NotificationEvent) =>
      set((s) => {
        if (
          event.dedupeKey &&
          s.notificationEvents.some(
            (existing) => existing.dedupeKey === event.dedupeKey
          )
        ) {
          return s;
        }
        return {
          notificationEvents: clampNotificationEvents([
            event,
            ...s.notificationEvents,
          ]),
        };
      }),

    markNotificationEventRead: (id: string) =>
      set((s) => ({
        notificationEvents: s.notificationEvents.map((event) =>
          event.id === id && event.readAt === null
            ? { ...event, readAt: Date.now() }
            : event
        ),
      })),

    markAllNotificationEventsRead: () =>
      set((s) => ({
        notificationEvents: s.notificationEvents.map((event) =>
          event.readAt === null ? { ...event, readAt: Date.now() } : event
        ),
      })),

    clearNotificationEvents: () => set({ notificationEvents: [] }),

    setLastNotificationScanAt: (timestamp: number) =>
      set({ lastNotificationScanAt: timestamp }),

    addAuditEvent: (event: AuditEvent) =>
      set((s) => ({
        auditEvents: clampAuditEvents([event, ...s.auditEvents]),
      })),

    clearAuditEvents: () => set({ auditEvents: [] }),

    addPriceSnapshot: (snapshot: PriceSnapshot) =>
      set((s) => {
        const latest = s.priceSnapshots[0];
        const priceFraction =
          latest && latest.priceUsd > 0
            ? Math.abs(latest.priceUsd - snapshot.priceUsd) / latest.priceUsd
            : Infinity;
        if (
          latest &&
          priceFraction < 0.001 &&
          snapshot.timestamp - latest.timestamp < 15 * 60 * 1000
        ) {
          return s;
        }
        return {
          priceSnapshots: clampPriceSnapshots([
            snapshot,
            ...s.priceSnapshots,
          ]),
        };
      }),

    addRuntimeIssue: (issue: RuntimeIssue) =>
      set((s) => ({
        runtimeIssues: clampRuntimeIssues([issue, ...s.runtimeIssues]),
      })),

    clearRuntimeIssues: () => set({ runtimeIssues: [] }),

    addRequestHistoryItem: (event: RequestHistoryItem) =>
      set((s) => ({
        requestHistory: clampRequestHistory([event, ...s.requestHistory]),
      })),

    updateRequestHistoryItem: (
      id: string,
      updates: Partial<Omit<RequestHistoryItem, "id" | "createdAt">>
    ) =>
      set((s) => ({
        requestHistory: clampRequestHistory(
          s.requestHistory.map((event) =>
            event.id === id ? { ...event, ...updates } : event
          )
        ),
      })),

    clearRequestHistory: () => set({ requestHistory: [] }),
  };
}
