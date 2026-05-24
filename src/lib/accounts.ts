import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import type { SessionWallet } from "@/lib/session-wallet";
import type { AccountMeta, VaultMeta } from "@/store/persisted";

export function sanitizeAccountTags(tags: string[]): string[] {
  return [...new Set(
    tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8),
  )].slice(0, 8);
}

export function parseAccountTags(input: string): string[] {
  return sanitizeAccountTags(input.split(/[,\n]/g));
}

export function getAccountIdentity(account: AccountMeta, wallet?: SessionWallet | null): string | null {
  return wallet?.identity ?? account.identity ?? null;
}

export function getVaultAccountIdentity(
  vault: VaultMeta | null | undefined,
  accountIndex: number,
  wallets: SessionWallet[],
): string | null {
  if (!vault) return wallets[accountIndex]?.identity ?? null;
  const account = vault.accounts.find((item) => item.index === accountIndex);
  return getAccountIdentity(account ?? { index: accountIndex, name: "", addedAt: 0, hidden: false }, wallets[accountIndex] ?? null);
}

export function isWatchOnlyVault(vault: VaultMeta | null | undefined): boolean {
  return vault?.kind === "watch_only";
}

export function getKnownAddressLabel(identity: string): string | null {
  return KNOWN_CONTRACT_ADDRESSES[identity] ?? null;
}
