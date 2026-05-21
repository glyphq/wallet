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
  dateFrom: string;                          // ranges.timestamp.gte (ISO date "YYYY-MM-DD")
  dateTo: string;                            // ranges.timestamp.lte (ISO date "YYYY-MM-DD")
  tickFrom: string;                          // ranges.tickNumber.gte
  tickTo: string;                            // ranges.tickNumber.lte
};

export const DEFAULT_QUERY_FILTERS: TxQueryFilters = {
  direction: "all", type: "all",
  minAmount: "", maxAmount: "",
  dateFrom: "", dateTo: "",
  tickFrom: "", tickTo: "",
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
  const { direction, type, minAmount, maxAmount, dateFrom, dateTo, tickFrom, tickTo } = queryFilters;

  return useInfiniteQuery({
    queryKey: [...qk.txHistory(identity ?? null), direction, type, minAmount, maxAmount, dateFrom, dateTo, tickFrom, tickTo],
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

      const timestampRange: { gte?: string; lte?: string } = {};
      if (dateFrom) timestampRange.gte = String(new Date(dateFrom + "T00:00:00").getTime());
      if (dateTo) timestampRange.lte = String(new Date(dateTo + "T23:59:59.999").getTime());
      if (Object.keys(timestampRange).length) txRanges.timestamp = timestampRange;

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

          // Amount range
          if (Object.keys(amountRange).length) evtRanges.amount = amountRange;

          // Timestamp range
          if (Object.keys(timestampRange).length) evtRanges.timestamp = timestampRange;

          // Tick range
          if (Object.keys(tickRange).length) evtRanges.tickNumber = tickRange;

          const evtResult = await getRpcClient().archive.getEventLogs({
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
