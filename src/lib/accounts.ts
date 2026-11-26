import type { SessionAccount } from "@/lib/session-account";
import type { AccountMeta, WalletMeta } from "@/store/persisted";

export function getAccountIdentity(account: AccountMeta, wallet?: SessionAccount | null): string | null {
  return wallet?.identity ?? account.identity ?? null;
}

export function getWalletAccountIdentity(
  wallet: WalletMeta | null | undefined,
  accountIndex: number,
  wallets: SessionAccount[],
): string | null {
  if (!wallet) return wallets[accountIndex]?.identity ?? null;
  const account = wallet.accounts.find((item) => item.index === accountIndex);
  return getAccountIdentity(account ?? { index: accountIndex, name: "", addedAt: 0 }, wallets[accountIndex] ?? null);
}
