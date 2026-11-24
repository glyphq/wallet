import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SETTINGS } from "./persisted-defaults";
import { mergePersistedState } from "./persisted-boundary";
import type { PersistedState } from "./persisted-types";
import { tauriStorage } from "./persisted-storage";
import { createActivityActions } from "./persisted-actions-activity";
import { createDappActions } from "./persisted-actions-dapps";
import { createWalletActions } from "./persisted-actions-wallets";

export type {
  AccountMeta,
  AccentColorId,
  AppSettings,
  ApprovedDapp,
  AuditEvent,
  AuditEventKind,
  Contact,
  FontPairId,
  NetworkConfig,
  NotificationEvent,
  NotificationEventKind,
  PendingTx,
  PriceSnapshot,
  RequestHistoryAction,
  RequestHistoryCallbackStatus,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
  ThemeMode,
  WalletColor,
  WalletIconId,
  WalletMeta,
} from "./persisted-types";

/** Zustand store backed by Tauri LazyStore (`glyph.json` on disk). Survives app restarts. */
export const usePersistedStore = create<PersistedState>()(
  persist(
    (set) => ({
      wallets: [],
      settings: DEFAULT_SETTINGS,
      contacts: [],
      pendingTxs: [],
      txMemos: {},
      txTags: {},
      scheduledTransfers: [],
      notificationEvents: [],
      priceSnapshots: [],
      runtimeIssues: [],
      auditEvents: [],
      requestHistory: [],
      lastNotificationScanAt: 0,
      passwordLockoutUntil: 0,
      passwordAttempts: 0,
      exportSigningKey: null,

      ...createWalletActions(set),
      ...createDappActions(set),
      ...createActivityActions(set),
    }),
    {
      name: "glyph-persisted",
      storage: createJSONStorage(() => tauriStorage),
      // Deep-merge settings so new fields added to DEFAULT_SETTINGS survive rehydration.
      // Validate array fields so corrupted JSON cannot replace typed arrays with scalars.
      merge: mergePersistedState,
    }
  )
);
