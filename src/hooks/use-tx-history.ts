import { useInfiniteQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { qk } from "@/lib/query-keys";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";

export type TxHistoryItem = {
  hash: string;
  source: string | null;
  destination: string | null;
  amount: string;
  tickNumber: number;
  moneyFlew: boolean;
};

export type TxQueryFilters = {
  direction: "all" | "in" | "out";
  type: "all" | "transfer" | "sc";
  minAmount: string;
  period: "all" | "7d" | "30d";
};

export const DEFAULT_QUERY_FILTERS: TxQueryFilters = {
  direction: "all",
  type: "all",
  minAmount: "",
  period: "all",
};

const PAGE_SIZE = 50;

/** Infinite-paginated tx history for `identity`.
 *  Direction, type, amount, and period filters are applied server-side.
 *  Primary: getTransactionsForIdentity (full history).
 *  Supplement (page 0 only): getEventLogs QuTransfer events for SC-initiated payouts.
 */
export function useTxHistory(
  identity: string | null | undefined,
  queryFilters: TxQueryFilters = DEFAULT_QUERY_FILTERS,
) {
  const { direction, type, minAmount, period } = queryFilters;

  return useInfiniteQuery({
    queryKey: [...qk.txHistory(identity ?? null), direction, type, minAmount, period],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam;

      // Build server-side filter params for getTransactionsForIdentity
      const txFilters: Record<string, string> = {};
      const txRanges: Record<string, { gte?: string; lte?: string }> = {};

      if (direction === "in") txFilters.destination = identity!;
      else if (direction === "out") txFilters.source = identity!;

      if (type === "transfer") txFilters.inputType = "0";
      else if (type === "sc") txRanges.inputType = { gte: "1" };

      if (minAmount) txRanges.amount = { gte: minAmount };

      const periodMs = period === "7d" ? 7 * 86_400_000 : period === "30d" ? 30 * 86_400_000 : 0;
      if (periodMs) txRanges.timestamp = { gte: String(Date.now() - periodMs) };

      const txResult = await getRpcClient().archive.getTransactionsForIdentity({
        identity: identity!,
        ...(Object.keys(txFilters).length && { filters: txFilters }),
        ...(Object.keys(txRanges).length && { ranges: txRanges }),
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

      // Event log supplement on first page only (logs cover ~2 weeks)
      if (offset === 0) {
        try {
          // Build event log params respecting direction + period + amount filters
          const evtFilters: Record<string, string> = {};
          const evtRanges: Record<string, { gte?: string; lte?: string }> = {};

          if (direction === "in") evtFilters.destination = identity!;
          else if (direction === "out") evtFilters.source = identity!;

          if (minAmount) evtRanges.amount = { gte: minAmount };
          if (periodMs) evtRanges.timestamp = { gte: String(Date.now() - periodMs) };

          const evtResult = await getRpcClient().archive.getEventLogs({
            // direction="all" needs should (OR); in/out use filters directly
            ...(direction === "all"
              ? { should: [{ terms: { source: identity!, destination: identity! } }] }
              : { filters: evtFilters }),
            ...(Object.keys(evtRanges).length && { ranges: evtRanges }),
            pagination: { size: PAGE_SIZE, offset: 0 },
          });

          if (evtResult.ok) {
            for (const evt of evtResult.value.eventLogs ?? []) {
              if (!evt.transactionHash || !evt.quTransfer) continue;
              if (items.has(evt.transactionHash)) continue;

              // Apply type filter to event log entries client-side
              // (SC payouts: source is a contract, which won't have inputType)
              // type="transfer": skip entries from contracts
              // type="sc": only entries from contracts
              const sourceIsContract = evt.quTransfer.source ? isKnownContract(evt.quTransfer.source) : false;
              if (type === "transfer" && sourceIsContract) continue;
              if (type === "sc" && !sourceIsContract) continue;

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

function isKnownContract(address: string): boolean {
  return !!KNOWN_CONTRACT_ADDRESSES[address];
}
