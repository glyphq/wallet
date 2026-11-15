import type { AccountMeta, VaultMeta } from "./persisted-types";
import { MAX_ACCOUNTS_PER_VAULT } from "./persisted-limits";

/** Validates persisted vault metadata, defaulting missing account fields. */
export function mergeVaults(value: unknown, current: VaultMeta[]): VaultMeta[] {
  if (!Array.isArray(value)) return current;
  return value
    .filter((vault): vault is VaultMeta => !!vault && typeof vault === "object")
    .map(
      (vault): VaultMeta => ({
        ...vault,
        kind: "seeded",
        encryptedData: vault.encryptedData ?? null,
        accounts: Array.isArray(vault.accounts)
          ? vault.accounts
              .filter(
                (account): account is AccountMeta =>
                  !!account && typeof account === "object"
              )
              .slice(0, MAX_ACCOUNTS_PER_VAULT)
              .map((account) => ({
                ...account,
                note: typeof account.note === "string" ? account.note : "",
                tags: Array.isArray(account.tags)
                  ? account.tags.filter(
                      (tag): tag is string => typeof tag === "string"
                    )
                  : [],
                identity:
                  typeof account.identity === "string"
                    ? account.identity
                    : undefined,
              }))
          : [],
      })
    );
}
