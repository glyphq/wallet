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
  // Server-side — getTransactionsForIdentity + getEventLogs
  direction: "all" | "in" | "out";         // filters.source / destination
  type: "all" | "transfer" | "sc";          // filters/ranges.inputType
  minAmount: string;                         // ranges.amount.gte
  maxAmount: string;                         // ranges.amount.lte
  period: "all" | "7d" | "30d";             // ranges.timestamp.gte (preset)
  tickFrom: string;                          // ranges.tickNumber.gte
  tickTo: string;                            // ranges.tickNumber.lte
  // Event-log only
  epoch: string;                             // filters.epoch (event logs; txs have no epoch filter)
};

export const DEFAULT_QUERY_FILTERS: TxQueryFilters = {
  direction: "all", type: "all",
  minAmount: "", maxAmount: "",
  period: "all",
  tickFrom: "", tickTo: "",
  epoch: "",
};

const PAGE_SIZE = 50;

/** Infinite-paginated tx history for `identity`.
 *  All non-status filters are pushed server-side. Status (moneyFlew) stays client-side.
 *  Supplement (page 0 only): getEventLogs for SC-initiated payouts absent from the tx index.
 */
export function useTxHistory(
  identity: string | null | undefined,
  queryFilters: TxQueryFilters = DEFAULT_QUERY_FILTERS,
) {
  const { direction, type, minAmount, maxAmount, period, tickFrom, tickTo, epoch } = queryFilters;

  return useInfiniteQuery({
    queryKey: [...qk.txHistory(identity ?? null), direction, type, minAmount, maxAmount, period, tickFrom, tickTo, epoch],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam;

      // ── getTransactionsForIdentity params ────────────────────────────────
      const txFilters: Record<string, string> = {};
      const txRanges: Record<string, { gte?: string; lte?: string }> = {};

      if (direction === "in") txFilters.destination = identity!;
      else if (direction === "out") txFilters.source = identity!;

      if (type === "transfer") txFilters.inputType = "0";
      else if (type === "sc") txRanges.inputType = { gte: "1" };

      const amountRange: { gte?: string; lte?: string } = {};
      if (minAmount) amountRange.gte = minAmount;
      if (maxAmount) amountRange.lte = maxAmount;
      if (Object.keys(amountRange).length) txRanges.amount = amountRange;

      const periodMs = period === "7d" ? 7 * 86_400_000 : period === "30d" ? 30 * 86_400_000 : 0;
      if (periodMs) txRanges.timestamp = { gte: String(Date.now() - periodMs) };

      const tickRange: { gte?: string; lte?: string } = {};
      if (tickFrom) tickRange.gte = tickFrom;
      if (tickTo) tickRange.lte = tickTo;
      if (Object.keys(tickRange).length) txRanges.tickNumber = tickRange;

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

      // ── getEventLogs supplement (first page only, ~2 week window) ────────
      if (offset === 0) {
        try {
          const evtFilters: Record<string, string> = {};
          const evtRanges: Record<string, { gte?: string; lte?: string }> = {};

          // Direction for event logs
          if (direction === "in") evtFilters.destination = identity!;
          else if (direction === "out") evtFilters.source = identity!;

          // Epoch filter (event logs support this; tx endpoint does not)
          if (epoch) evtFilters.epoch = epoch;

          // Amount range
          if (Object.keys(amountRange).length) evtRanges.amount = amountRange;

          // Timestamp period
          if (periodMs) evtRanges.timestamp = { gte: String(Date.now() - periodMs) };

          // Tick range
          if (Object.keys(tickRange).length) evtRanges.tickNumber = tickRange;

          const evtResult = await getRpcClient().archive.getEventLogs({
            ...(direction === "all"
              ? { should: [{ terms: { source: identity!, destination: identity! } }] }
              : { filters: evtFilters }),
            // When direction="all", epoch goes in filters alongside should (different property, allowed)
            ...(direction === "all" && epoch && { filters: { epoch } }),
            ...(Object.keys(evtRanges).length && { ranges: evtRanges }),
            pagination: { size: PAGE_SIZE, offset: 0 },
          });

          if (evtResult.ok) {
            for (const evt of evtResult.value.eventLogs ?? []) {
              if (!evt.transactionHash || !evt.quTransfer) continue;
              if (items.has(evt.transactionHash)) continue;

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
