import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listIdentityTransactions } from "@/lib/api/generated";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { buildWalletAnalytics, type AnalyticsTxLike } from "@/lib/history-analytics";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { dedupeTxRecords, normalizeApiTransaction } from "@/lib/tx-domain";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // cap at 2 000 transactions per identity

async function fetchAllTransactionsForIdentity(identity: string, signal?: AbortSignal): Promise<AnalyticsTxLike[]> {
  const transactions: AnalyticsTxLike[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (signal?.aborted) break;
    const { data } = await listIdentityTransactions({
      path: { identity },
      query: { limit: PAGE_SIZE, cursor },
      signal,
      throwOnError: true,
    });
    const normalized = data.data
      .map(normalizeApiTransaction)
      .filter((tx): tx is NonNullable<typeof tx> => !!tx)
      .map((tx) => ({
        hash: tx.hash,
        source: tx.source,
        destination: tx.destination,
        amount: tx.amount,
        timestamp: tx.timestamp,
        moneyFlew: tx.moneyFlew,
      }));
    transactions.push(...normalized);
    if (data.data.length < PAGE_SIZE || !data.meta.next_cursor) break;
    cursor = data.meta.next_cursor;
  }

  return transactions;
}

export function useWalletAnalytics() {
  const settings = usePersistedStore((s) => s.settings);
  const wallet = usePersistedStore((s) => s.wallets.find((item) => item.id === s.settings.activeWalletId) ?? null);
  const accounts = useSessionStore((s) => s.accounts);
  const apiIdentity = useApiCacheIdentity();

  const identities = useMemo(() => {
    if (!wallet) return [] as string[];
    return wallet.accounts
      .filter((account) => !account.hidden)
      .map((account) => getWalletAccountIdentity(wallet, account.index, accounts))
      .filter((identity): identity is string => !!identity);
  }, [wallet, accounts]);

  return useQuery({
    queryKey: ["wallet-analytics", settings.activeWalletId, apiIdentity, identities],
    queryFn: async ({ signal }) => {
      const all = await Promise.all(identities.map((identity) => fetchAllTransactionsForIdentity(identity, signal)));
      return buildWalletAnalytics(new Set(identities), dedupeTxRecords(all.flat()));
    },
    enabled: identities.length > 0,
    staleTime: 60_000,
  });
}
