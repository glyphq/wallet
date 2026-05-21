import { useInfiniteQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { qk } from "@/lib/query-keys";

export type TxHistoryItem = {
  hash: string;
  source: string | null;
  destination: string | null;
  amount: string;
  tickNumber: number;
  moneyFlew: boolean;
};

const PAGE_SIZE = 50;

/** Infinite-paginated tx history for `identity`.
 *  Primary: getTransactionsForIdentity (full history, 50/page).
 *  Supplement (page 0 only): getEventLogs QuTransfer events for SC-initiated payouts
 *  (e.g. QUTIL distributions) absent from the transaction index.
 */
export function useTxHistory(identity: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: qk.txHistory(identity ?? null),
    queryFn: async ({ pageParam }) => {
      const offset = pageParam;

      const txResult = await getRpcClient().archive.getTransactionsForIdentity({
        identity: identity!,
        pagination: { size: PAGE_SIZE, offset },
      });

      if (!txResult.ok) throw txResult.error;

      const items = new Map<string, TxHistoryItem>();

      for (const tx of txResult.value.transactions ?? []) {
        if (!tx.hash) continue;
        items.set(tx.hash, {
          hash: tx.hash,
          source: tx.source ?? null,
          destination: tx.destination ?? null,
          amount: tx.amount ?? "0",
          tickNumber: tx.tickNumber ?? 0,
          moneyFlew: tx.moneyFlew ?? true,
        });
      }

      // Event log supplement on first page only (logs only cover ~2 weeks)
      if (offset === 0) {
        try {
          const evtResult = await getRpcClient().archive.getEventLogs({
            should: [{ terms: { source: identity!, destination: identity! } }],
            pagination: { size: PAGE_SIZE, offset: 0 },
          });
          if (evtResult.ok) {
            for (const evt of evtResult.value.eventLogs ?? []) {
              if (!evt.transactionHash || !evt.quTransfer) continue;
              if (items.has(evt.transactionHash)) continue;
              items.set(evt.transactionHash, {
                hash: evt.transactionHash,
                source: evt.quTransfer.source ?? null,
                destination: evt.quTransfer.destination ?? null,
                amount: evt.quTransfer.amount ?? "0",
                tickNumber: evt.tickNumber ?? 0,
                moneyFlew: true,
              });
            }
          }
        } catch { /* non-fatal */ }
      }

      return Array.from(items.values()).sort((a, b) => b.tickNumber - a.tickNumber);
    },
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length >= PAGE_SIZE ? lastPageParam + PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: !!identity,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}
