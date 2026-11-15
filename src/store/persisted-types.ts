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
  ApprovedDapp,
  Contact,
  VaultMeta,
} from "./persisted-types-vault";

export type {
  AccountMeta,
  AccentColorId,
  AppSettings,
  ApprovedDapp,
  Contact,
  FontPairId,
  NetworkConfig,
  ThemeMode,
  VaultColor,
  VaultMeta,
  WalletIconId,
} from "./persisted-types-vault";
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
  vaults: VaultMeta[];
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
  /** HMAC signing key for vault export envelopes — stored separately from settings for isolation. */
  exportSigningKey: JsonWebKey | null;
  setPasswordLockoutUntil: (until: number) => void;
  setPasswordAttempts: (n: number) => void;
  addVault: (vault: VaultMeta) => void;
  updateVault: (id: string, updates: Partial<Omit<VaultMeta, "id">>) => void;
  /** Removes the vault; if it was active, falls back to the first remaining vault (or null). */
  removeVault: (id: string) => void;
  /** Sets the active vault and resets `activeAccountIndex` to 0. */
  setActiveVault: (id: string | null) => void;
  setActiveAccountIndex: (index: number) => void;
  /** Stamps `lastUnlockedAt` with the current time — used to sort vaults by recency. */
  touchVaultUnlocked: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Omit<Contact, "id">>) => void;
  removeContact: (id: string) => void;
  addPendingTx: (tx: PendingTx) => void;
  removePendingTx: (hash: string) => void;
  /** Upserts a dApp approval — merges permissions and allowed identities into an existing entry rather than replacing it. */
  approveDapp: (dapp: ApprovedDapp) => void;
  revokeDapp: (origin: string) => void;
  /** Removes a single permission while leaving the persisted dApp connection entry intact. */
  revokeDappPermission: (
    origin: string,
    permission: ApprovedDapp["permissions"][number]
  ) => void;
  setDappAllowedIdentities: (
    origin: string,
    identities: string[] | undefined
  ) => void;
  setDappPolicy: (
    origin: string,
    policy: Pick<ApprovedDapp, "transferLimitQu" | "expiryDurationMs" | "expiresAt">
  ) => void;
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
