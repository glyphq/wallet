export interface SessionAccount {
  identity: string;
  publicKey: Uint8Array;
  walletId?: string;
  walletName?: string;
  accountName?: string;
}
