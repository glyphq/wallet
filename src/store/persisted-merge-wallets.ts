import type { AccountMeta, WalletMeta } from "./persisted-types";
import { MAX_ACCOUNTS_PER_WALLET } from "./persisted-limits";

/** Validates persisted wallet metadata, defaulting missing account fields. */
export function mergeWallets(value: unknown, current: WalletMeta[]): WalletMeta[] {
  if (!Array.isArray(value)) return current;
  return value
    .filter((wallet): wallet is WalletMeta => !!wallet && typeof wallet === "object")
    .map(
      (wallet): WalletMeta => ({
        ...wallet,
        kind: "seeded",
        encryptedData: wallet.encryptedData ?? null,
        accounts: Array.isArray(wallet.accounts)
          ? wallet.accounts
              .filter(
                (account): account is AccountMeta =>
                  !!account && typeof account === "object"
              )
              .slice(0, MAX_ACCOUNTS_PER_WALLET)
              .map((account) => ({
                ...account,
                note: typeof account.note === "string" ? account.note : "",
                identity:
                  typeof account.identity === "string"
                    ? account.identity
                    : undefined,
              }))
          : [],
      })
    );
}
