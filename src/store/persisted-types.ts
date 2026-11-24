import type {
  AuditEvent,
  NotificationEvent,
  PendingTx,
  PriceSnapshot,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
} from "./persisted-types-activity";
import type {
  AppSettings,
  Contact,
  WalletMeta,
} from "./persisted-types-wallet";

export type {
  AccountMeta,
  AccentColorId,
  AppSettings,
  Contact,
  FontPairId,
  NetworkConfig,
  ThemeMode,
  WalletColor,
  WalletMeta,
  WalletIconId,
} from "./persisted-types-wallet";
export type {
  AuditEvent,
  AuditEventKind,
  NotificationEvent,
  NotificationEventKind,
  PendingTx,
  PriceSnapshot,
  RequestHistoryAction,
  RequestHistoryCallbackStatus,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
} from "./persisted-types-activity";

export interface PersistedState {
  wallets: WalletMeta[];
  settings: AppSettings;
  contacts: Contact[];
  pendingTxs: PendingTx[];
  /** tx hash → user note, persisted locally */
  txMemos: Record<string, string>;
  /** @deprecated Kept for migration compat only — no longer used in UI. */
  txTags: Record<string, string[]>;
  scheduledTransfers: ScheduledTransfer[];
  notificationEvents: NotificationEvent[];
  priceSnapshots: PriceSnapshot[];
  runtimeIssues: RuntimeIssue[];
  auditEvents: AuditEvent[];
  requestHistory: RequestHistoryItem[];
  lastNotificationScanAt: number;
  /** Unix ms timestamp until which password attempts are locked out. 0 = no lockout. */
  passwordLockoutUntil: number;
  /** Number of consecutive failed password attempts — persists across restarts. */
  passwordAttempts: number;
  /** HMAC signing key for wallet export envelopes — stored separately from settings for isolation. */
  exportSigningKey: JsonWebKey | null;
  setPasswordLockoutUntil: (until: number) => void;
  setPasswordAttempts: (n: number) => void;
  addWallet: (wallet: WalletMeta) => void;
  updateWallet: (id: string, updates: Partial<Omit<WalletMeta, "id">>) => void;
  /** Removes the wallet; if it was active, falls back to the first remaining wallet (or null). */
  removeWallet: (id: string) => void;
  /** Sets the active wallet and resets `activeAccountIndex` to 0. */
  setActiveWallet: (id: string | null) => void;
  setActiveAccountIndex: (index: number) => void;
  /** Stamps `lastUnlockedAt` with the current time — used to sort wallets by recency. */
  touchWalletUnlocked: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Omit<Contact, "id">>) => void;
  removeContact: (id: string) => void;
  addPendingTx: (tx: PendingTx) => void;
  removePendingTx: (hash: string) => void;
  /** Upserts a dApp approval using the scope granted in that connection request. */
  setTxMemo: (hash: string, memo: string) => void;
  deleteTxMemo: (hash: string) => void;
  addScheduledTransfer: (transfer: ScheduledTransfer) => void;
  updateScheduledTransfer: (
    id: string,
    updates: Partial<Omit<ScheduledTransfer, "id" | "createdAt">>
  ) => void;
  removeScheduledTransfer: (id: string) => void;
  addNotificationEvent: (event: NotificationEvent) => void;
  markNotificationEventRead: (id: string) => void;
  markAllNotificationEventsRead: () => void;
  clearNotificationEvents: () => void;
  setLastNotificationScanAt: (timestamp: number) => void;
  addAuditEvent: (event: AuditEvent) => void;
  clearAuditEvents: () => void;
  addPriceSnapshot: (snapshot: PriceSnapshot) => void;
  addRuntimeIssue: (issue: RuntimeIssue) => void;
  clearRuntimeIssues: () => void;
  addRequestHistoryItem: (event: RequestHistoryItem) => void;
  updateRequestHistoryItem: (
    id: string,
    updates: Partial<Omit<RequestHistoryItem, "id" | "createdAt">>
  ) => void;
  clearRequestHistory: () => void;
}
