export const qk = {
  vaultBalances: (apiIdentity: string, identities: string[]) => ["vault-balances", apiIdentity, identities] as const,
  txHistory: (apiIdentity: string, identity: string | null) => ["tx-history", apiIdentity, identity] as const,
  tickInfo: (apiIdentity: string) => ["tick-info", apiIdentity] as const,
  lastProcessedTick: (apiIdentity: string) => ["last-processed-tick", apiIdentity] as const,
  qearnEpochInfo: (apiIdentity: string, epoch: number | null) => ["qearn-epoch-info", apiIdentity, epoch] as const,
  qearnPositions: (apiIdentity: string, identity: string | null, epoch: number | null) => ["qearn-positions", apiIdentity, identity, epoch] as const,
  qutilSendManyFee: (apiIdentity: string) => ["qutil-send-many-fee", apiIdentity] as const,
} as const;
