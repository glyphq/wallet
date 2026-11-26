export const qk = {
  walletBalances: (apiIdentity: string, identities: string[]) => ["wallet-balances", apiIdentity, identities] as const,
  txHistory: (apiIdentity: string, identity: string | null) => ["tx-history", apiIdentity, identity] as const,
  tickInfo: (apiIdentity: string) => ["tick-info", apiIdentity] as const,
  lastProcessedTick: (apiIdentity: string) => ["last-processed-tick", apiIdentity] as const,
  qutilSendManyFee: (apiIdentity: string) => ["qutil-send-many-fee", apiIdentity] as const,
  msvaultFees: (apiIdentity: string) => ["msvault", "fees", apiIdentity] as const,
  msvaultVaults: (apiIdentity: string, identity: string) =>
    ["msvault", "vaults", apiIdentity, identity] as const,
  msvaultVault: (apiIdentity: string, vaultId: string) =>
    ["msvault", "vault", apiIdentity, vaultId] as const,
  msvaultManagedAsset: (apiIdentity: string, identity: string, assetKey: string) =>
    ["msvault", "managed-asset", apiIdentity, identity, assetKey] as const,
  msvaultAssetMeta: (apiIdentity: string, issuer: string, name: string) =>
    ["msvault", "asset-meta", apiIdentity, issuer, name] as const,
} as const;
