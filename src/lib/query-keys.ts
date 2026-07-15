export const qk = {
  vaultBalances: (rpcIdentity: string, identities: string[]) => ["vault-balances", rpcIdentity, identities] as const,
  balance: (rpcIdentity: string, identity: string | null) => ["balance", rpcIdentity, identity] as const,
  txHistory: (rpcIdentity: string, identity: string | null) => ["tx-history", rpcIdentity, identity] as const,
  tickInfo: (rpcIdentity: string) => ["tick-info", rpcIdentity] as const,
  lastProcessedTick: (rpcIdentity: string) => ["last-processed-tick", rpcIdentity] as const,
  qearnEpochInfo: (rpcIdentity: string, epoch: number | null) => ["qearn-epoch-info", rpcIdentity, epoch] as const,
  qearnPositions: (rpcIdentity: string, identity: string | null, epoch: number | null) => ["qearn-positions", rpcIdentity, identity, epoch] as const,
  qutilSendManyFee: (rpcIdentity: string) => ["qutil-send-many-fee", rpcIdentity] as const,
} as const;
