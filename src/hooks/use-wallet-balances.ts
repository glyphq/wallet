import { useQuery } from "@tanstack/react-query";
import { getQutilBalances16 } from "@/lib/api/contracts";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { qk } from "@/lib/query-keys";

import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

export const MAX_WALLET_ACCOUNTS = 16;

/** Polls balances for all unlocked wallet accounts in one getBalances16 SC query.
 *  When locked and notifyWhenLocked is enabled, falls back to identities cached at last unlock. */
export function useWalletBalances() {
  const accounts = useSessionStore((s) => s.accounts);
  const cachedIdentities = useSessionStore((s) => s.cachedIdentities);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);

  const apiIdentity = useApiCacheIdentity();

  const liveIdentities = accounts.slice(0, MAX_WALLET_ACCOUNTS).map((account) => account.identity);
  const identities = liveIdentities.length > 0
    ? liveIdentities
    : (notifyWhenLocked ? cachedIdentities : []);

  return useQuery({
    queryKey: qk.walletBalances(apiIdentity, identities),
    queryFn: async () => {
      const result = await getQutilBalances16(identities);
      if (!result.ok) throw result.error;
      const balances = result.value.balances;
      if (balances.length < identities.length) {
        throw new Error(`balance response length mismatch: expected at least ${identities.length}, got ${balances.length}`);
      }
      const map: Record<string, bigint> = {};
      for (let i = 0; i < identities.length; i++) {
        map[identities[i]] = balances[i];
      }
      return map;
    },
    enabled: identities.length > 0,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
