import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { buildVaultAnalytics, type AnalyticsTxLike } from "@/lib/history-analytics";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { dedupeTxRecords, normalizeArchiveTransaction } from "@/lib/tx-domain";
import { useRpcCacheSnapshot } from "@/hooks/use-rpc-cache-identity";
import { qk } from "@/lib/query-keys";
import type { QubicClient } from "@/lib/rpc";

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // cap at 2 000 transactions per identity

async function fetchAllTransactionsForIdentity(client: QubicClient, identity: string, signal?: AbortSignal): Promise<AnalyticsTxLike[]> {
  const transactions: AnalyticsTxLike[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (signal?.aborted) break;
    const result = await client.archive.getTransactionsForIdentity({
      identity,
      pagination: { size: PAGE_SIZE, offset },
    });
    if (!result.ok) break;
    const records = result.value.transactions ?? [];
    const normalized = records
      .map(normalizeArchiveTransaction)
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
    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return transactions;
}

export function useVaultAnalytics() {
  const rpc = useRpcCacheSnapshot("archive");
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((item) => item.id === s.settings.activeVaultId) ?? null);
  const wallets = useSessionStore((s) => s.wallets);

  const identities = useMemo(() => {
    if (!vault) return [] as string[];
    return vault.accounts
      .filter((account) => !account.hidden)
      .map((account) => getVaultAccountIdentity(vault, account.index, wallets))
      .filter((identity): identity is string => !!identity);
  }, [vault, wallets]);

  return useQuery({
    queryKey: qk.vaultAnalytics(rpc.identity, settings.activeVaultId, identities),
    queryFn: async ({ signal }) => {
      const all = await Promise.all(identities.map((identity) => fetchAllTransactionsForIdentity(rpc.client, identity, signal)));
      return buildVaultAnalytics(new Set(identities), dedupeTxRecords(all.flat()));
    },
    enabled: identities.length > 0,
    staleTime: 60_000,
  });
}
