import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { buildVaultAnalytics, type AnalyticsTxLike } from "@/lib/history-analytics";
import { getVaultAccountIdentity } from "@/lib/accounts";

const PAGE_SIZE = 100;

async function fetchAllTransactionsForIdentity(identity: string): Promise<AnalyticsTxLike[]> {
  const client = getRpcClient();
  const transactions: AnalyticsTxLike[] = [];
  let offset = 0;

  while (true) {
    const result = await client.archive.getTransactionsForIdentity({
      identity,
      pagination: { size: PAGE_SIZE, offset },
    });
    if (!result.ok) break;
    const page = result.value.transactions ?? [];
    transactions.push(
      ...page
        .filter((tx) => !!tx.hash)
        .map((tx) => ({
          hash: tx.hash ?? "",
          source: tx.source ?? null,
          destination: tx.destination ?? null,
          amount: tx.amount ?? "0",
          timestamp: tx.timestamp ? Number(tx.timestamp) : null,
          moneyFlew: tx.moneyFlew ?? true,
        })),
    );
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return transactions;
}

export function useVaultAnalytics() {
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((item) => item.id === s.settings.activeVaultId) ?? null);
  const wallets = useSessionStore((s) => s.wallets);

  const identities = (vault?.accounts ?? [])
    .filter((account) => !account.hidden)
    .map((account) => getVaultAccountIdentity(vault, account.index, wallets))
    .filter((identity): identity is string => !!identity);

  return useQuery({
    queryKey: ["vault-analytics", settings.activeVaultId, identities],
    queryFn: async () => {
      const all = await Promise.all(identities.map((identity) => fetchAllTransactionsForIdentity(identity)));
      const byHash = new Map<string, AnalyticsTxLike>();
      for (const tx of all.flat()) {
        if (!byHash.has(tx.hash)) byHash.set(tx.hash, tx);
      }
      return buildVaultAnalytics(new Set(identities), [...byHash.values()]);
    },
    enabled: identities.length > 0,
    staleTime: 60_000,
  });
}
