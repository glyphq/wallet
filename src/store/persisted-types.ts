import type { VaultData } from "@qubic.org/wallet";

export type VaultColor =
  | "slate"
  | "red"
  | "amber"
  | "emerald"
  | "sky"
  | "violet";
export type WalletIconId =
  | "wallet"
  | "wallet-money"
  | "safe"
  | "shield"
  | "folder"
  | "home"
  | "buildings"
  | "compass"
  | "star"
  | "rocket"
  | "planet"
  | "key";
export type FontPairId =
  | "default"
  | "inter"
  | "ibm-plex"
  | "space-grotesk"
  | "fira"
  | "jetbrains";
export type AccentColorId =
  | "green"
  | "amber"
  | "sky"
  | "violet"
  | "rose"
  | "mono";

/** Persisted display metadata for a single account within a vault. Index mirrors position in the seed array. */
export interface AccountMeta {
  index: number;
  name: string;
  addedAt: number;
  /** When true the account is hidden from the account switcher but remains in the seed array. */
  hidden: boolean;
  /** Persisted identity for watch-only accounts and seeded-account metadata hydration. */
  identity?: string;
  note?: string;
  tags?: string[];
}

/** Persisted metadata for a vault — does not contain seeds; those live in `encryptedData`. */
export interface VaultMeta {
  id: string;
  name: string;
  color: VaultColor;
  icon?: WalletIconId;
  kind?: "seeded" | "watch_only";
  createdAt: number;
  lastUnlockedAt: number;
  accounts: AccountMeta[];
  encryptedData: VaultData | null;
}

export interface NetworkConfig {
  liveApiUrl: string;
  queryApiUrl: string;
  name: "mainnet" | "testnet" | "custom";
}

/** A dApp origin that the user has explicitly approved, along with its granted permission set. */
export interface ApprovedDapp {
  origin: string;
  name: string;
  approvedAt: number;
  /** Stamped each time a permission is exercised — used to sort/prune stale dApp entries. */
  lastUsedAt?: number;
  permissions: ("transfer" | "sc_call" | "sign_message")[];
  /** When set, restricts this dApp's permissions to these specific account identities only. */
  allowedIdentities?: string[];
}

export interface AppSettings {
  autoLockMinutes: number;
  lockOnSleep: boolean;
  lockOnWindowBlur: boolean;
  clipboardClearSeconds: number;
  network: NetworkConfig;
  activeVaultId: string | null;
  activeAccountIndex: number;
  hideBalances: boolean;
  approvedDapps: ApprovedDapp[];
  currency: "USD" | "EUR" | "BTC";
  /** Ticks added to the current tick when estimating targetTick for new transactions. Default 10. */
  tickOffset: number;
  debugMode: boolean;
  biometricVaultIds: string[];
  /** @deprecated Kept for migration compat — no longer configurable in UI. */
  fontPair: FontPairId;
  /** @deprecated Kept for migration compat — no longer configurable in UI. */
  accentColor: AccentColorId;
  /** @deprecated Kept for migration compat — no longer configurable in UI. */
  customScheme: { bg: string; text: string } | null;
  notificationsEnabled: boolean;
  notifyOnReceived: boolean;
  notifyOnSent: boolean;
  notifyOnConfirmed: boolean;
  notifyOnMissedConfirmations: boolean;
  notifyOnLargeIncoming: boolean;
  notifyOnPriceAlerts: boolean;
  notifyWhenLocked: boolean;
  largeIncomingThreshold: string;
  priceAlertAbove: string;
  priceAlertBelow: string;
  pollingIntervalActiveMs: number;
  pollingIntervalBackgroundMs: number;
  pollingIntervalTrayMs: number;
  pollingIntervalLockedMs: number;
  hideToTray: boolean;
  sponsorAttribution: "anonymous" | "identity" | "custom";
  allowBlurLockBypass: boolean;
  requirePasswordForBurn: boolean;
  requireBiometricForSeedReveal: boolean;
  highValueSendThreshold: string;
  /** @deprecated Kept for migration compat — signing key now in top-level exportSigningKey. */
  exportSigningPrivateJwk: JsonWebKey | null;
  /** QU amount below which a low-balance warning is shown on the dashboard. Empty string = disabled. */
  lowBalanceThreshold: string;
  /** Custom price feed URL; when set, useLatestStats fetches from this endpoint instead of the default. */
  customPriceFeedUrl: string;
}

export interface Contact {
  id: string;
  name: string;
  identity: string;
  note: string;
  addedAt: number;
  lastUsedAt: number;
  tags?: string[];
}

/** A recurring transfer that runs on a fixed day interval. */
export interface ScheduledTransfer {
  id: string;
  label: string;
  sourceIdentity: string;
  destination: string;
  amount: string;
  intervalDays: number;
  nextRunAt: number;
  createdAt: number;
  enabled: boolean;
}

/** A broadcast transaction awaiting confirmation or expiry tracking. */
export interface PendingTx {
  hash: string;
  source: string;
  destination: string;
  amount: string;
  targetTick: number;
  broadcastAt: number;
  /** Present for SC calls — used as the notification label instead of the raw amount. */
  contractName?: string;
}

export type NotificationEventKind =
  | "received"
  | "sent"
  | "confirmed"
  | "failed"
  | "expired"
  | "deep_link"
  | "price_alert";

export interface NotificationEvent {
  id: string;
  kind: NotificationEventKind;
  title: string;
  body: string;
  createdAt: number;
  readAt: number | null;
  identity?: string;
  txHash?: string;
  dedupeKey?: string;
}

export interface PriceSnapshot {
  timestamp: number;
  priceUsd: number;
}

export interface RuntimeIssue {
  id: string;
  source: "native" | "renderer" | "updater" | "storage";
  title: string;
  detail: string;
  createdAt: number;
}

export type AuditEventKind =
  | "unlock_succeeded"
  | "unlock_failed"
  | "seed_revealed"
  | "vault_exported"
  | "contacts_exported"
  | "request_received"
  | "request_approved"
  | "request_rejected"
  | "request_callback_failed";

export interface AuditEvent {
  id: string;
  kind: AuditEventKind;
  createdAt: number;
  status: "success" | "failure" | "info";
  title: string;
  detail: string;
  vaultId?: string;
  accountIndex?: number;
}

export type RequestHistoryAction = "approved" | "rejected";
export type RequestHistoryCallbackStatus = "none" | "pending" | "ok" | "failed";

export interface RequestHistoryItem {
  id: string;
  createdAt: number;
  type: "transfer" | "sc_call" | "sign_message" | "verify_message" | "connect";
  dappName: string;
  dappOrigin: string;
  action: RequestHistoryAction;
  accountIdentity?: string;
  accountName?: string;
  resultKind?: "tx" | "message" | "verify" | "connect";
  resultDetail?: string;
  callbackStatus: RequestHistoryCallbackStatus;
  callbackUrl?: string | null;
  callbackBody?: string;
  callbackUpdatedAt?: number | null;
}

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
