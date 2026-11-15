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
export type ThemeMode = "dark" | "light";

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
  /** Persisted identity used to hydrate seeded-account metadata while locked. */
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
  kind?: "seeded";
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
  /** Optional per-request QU ceiling for transfer-like requests from this dApp. */
  transferLimitQu?: string;
  /** User-selected approval lifetime, persisted so Settings can refresh the expiry with the same duration. */
  expiryDurationMs?: number;
  /** Unix ms timestamp after which this approval cannot be exercised. Undefined means no expiry. */
  expiresAt?: number;
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
  /** Dark or light theme. */
  themeMode: ThemeMode;
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
  /** Whether Glyph is registered to launch when the user signs in. */
  autostartEnabled: boolean;
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
