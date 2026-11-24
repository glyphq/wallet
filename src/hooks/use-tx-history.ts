import { useInfiniteQuery } from "@tanstack/react-query";
import { listIdentityEvents, listIdentityTransactions } from "@/lib/api/generated";
import { qk } from "@/lib/query-keys";

import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import {
  dedupeTxRecords,
  isKnownContract,
  normalizeApiEvent,
  normalizeApiTransaction,
  sortTxRecords,
  type TxRecord,
} from "@/lib/tx-domain";

export type TxHistoryItem = TxRecord;

export type TxQueryFilters = {
  // Applied client-side: the Glyph API identity feed is cursor-paginated only.
  direction: "all" | "in" | "out";         // source / destination
  type: "all" | "transfer" | "sc";          // input_type 0 vs contract call
  minAmount: string;                         // raw amount floor
  maxAmount: string;                         // raw amount ceiling
  dateFrom: string;                          // "YYYY-MM-DD"
  dateTo: string;                            // "YYYY-MM-DD"
  tickFrom: string;
  tickTo: string;
};

export const DEFAULT_QUERY_FILTERS: TxQueryFilters = {
  direction: "all", type: "all",
  minAmount: "", maxAmount: "",
  dateFrom: "", dateTo: "",
  tickFrom: "", tickTo: "",
};

const PAGE_SIZE = 50;
/** Upper bound on API pages consumed to fill one filtered UI page. */
const MAX_API_PAGES_PER_WINDOW = 10;

function parseAmount(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function matchesFilters(record: TxRecord, identity: string, filters: TxQueryFilters): boolean {
  if (filters.direction === "in" && record.destination !== identity) return false;
  if (filters.direction === "out" && record.source !== identity) return false;

  if (filters.type !== "all") {
    const contract = isKnownContract(record.source);
    if (filters.type === "transfer" && (record.inputType !== 0 || contract)) return false;
    if (filters.type === "sc" && !contract && (record.inputType == null || record.inputType === 0)) return false;
  }

  if (filters.minAmount || filters.maxAmount) {
    const amount = parseAmount(record.amount);
    if (amount !== null) {
      const min = filters.minAmount ? parseAmount(filters.minAmount) : null;
      const max = filters.maxAmount ? parseAmount(filters.maxAmount) : null;
      if (min !== null && amount < min) return false;
      if (max !== null && amount > max) return false;
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    const timestamp = record.timestamp;
    if (timestamp === null) return false;
    if (filters.dateFrom && timestamp < new Date(filters.dateFrom + "T00:00:00").getTime()) return false;
    if (filters.dateTo && timestamp > new Date(filters.dateTo + "T23:59:59.999").getTime()) return false;
  }

  if (filters.tickFrom && record.tickNumber < Number(filters.tickFrom)) return false;
  if (filters.tickTo && record.tickNumber > Number(filters.tickTo)) return false;

  return true;
}

/** Infinite-paginated tx history for `identity` from the Glyph API identity feeds.
 *  Filters are applied client-side over cursor-paged results. Page 0 also merges
 *  decoded QU-transfer events so contract-originated payouts appear in history. */
export function useTxHistory(
  identity: string | null | undefined,
  queryFilters: TxQueryFilters = DEFAULT_QUERY_FILTERS,
) {

  const apiIdentity = useApiCacheIdentity();
  const { direction, type, minAmount, maxAmount, dateFrom, dateTo, tickFrom, tickTo } = queryFilters;

  return useInfiniteQuery({
    queryKey: [...qk.txHistory(apiIdentity, identity ?? null), direction, type, minAmount, maxAmount, dateFrom, dateTo, tickFrom, tickTo],
    queryFn: async ({ pageParam, signal }) => {
      const collected: TxHistoryItem[] = [];
      let cursor = pageParam as string | undefined;
      let nextCursor: string | null = null;

      for (let page = 0; page < MAX_API_PAGES_PER_WINDOW; page++) {
        const { data } = await listIdentityTransactions({
          path: { identity: identity! },
          query: { limit: PAGE_SIZE, cursor },
          signal,
          throwOnError: true,
        });
        for (const tx of data.data) {
          const normalized = normalizeApiTransaction(tx);
          if (normalized && matchesFilters(normalized, identity!, queryFilters)) {
            collected.push(normalized);
          }
        }
        nextCursor = data.meta.next_cursor ?? null;
        if (collected.length >= PAGE_SIZE || !nextCursor) break;
        cursor = nextCursor;
      }

      // ── Event supplement (first page only) ───────────────────────────────
      if (!pageParam) {
        try {
          const { data } = await listIdentityEvents({
            path: { identity: identity! },
            query: { limit: PAGE_SIZE },
            signal,
            throwOnError: true,
          });
          for (const event of data.data) {
            const normalized = normalizeApiEvent(event);
            if (!normalized) continue;
            if (collected.some((item) => item.hash === normalized.hash)) continue;
            if (!matchesFilters(normalized, identity!, queryFilters)) continue;
            collected.push(normalized);
          }
        } catch { /* non-fatal */ }
      }

      return {
        items: sortTxRecords(dedupeTxRecords(collected)),
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!identity,
    staleTime: 30_000,
  });
}
