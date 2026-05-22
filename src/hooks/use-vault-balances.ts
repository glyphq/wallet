import { useQuery } from "@tanstack/react-query";
import { qUtilGetBalances16 } from "@qubic.org/contracts";
import { getRpcClient } from "@/lib/rpc";
import { identityToPublicKey } from "@/lib/crypto";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { qk } from "@/lib/query-keys";
import type { Identity } from "@qubic.org/types";

const idToPk = (id: string) => identityToPublicKey(id as Identity);

export const MAX_VAULT_ACCOUNTS = 16;

/** Polls balances for all unlocked wallet accounts in one getBalances16 SC query.
 *  When locked and notifyWhenLocked is enabled, falls back to identities cached at last unlock. */
export function useVaultBalances() {
  const wallets = useSessionStore((s) => s.wallets);
  const cachedIdentities = useSessionStore((s) => s.cachedIdentities);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);

  const liveIdentities = wallets.slice(0, MAX_VAULT_ACCOUNTS).map((w) => w.identity);
  const identities = liveIdentities.length > 0
    ? liveIdentities
    : (notifyWhenLocked ? cachedIdentities : []);

  return useQuery({
    queryKey: qk.vaultBalances(identities),
    queryFn: async () => {
      const result = await qUtilGetBalances16(
        getRpcClient().live,
        { publicKeys: identities },
        { identityToPublicKey: idToPk },
      );
      if (!result.ok) throw result.error;
      const map: Record<string, bigint> = {};
      for (let i = 0; i < identities.length; i++) {
        map[identities[i]] = result.value.balances[i] ?? 0n;
      }
      return map;
    },
    enabled: identities.length > 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
}
