import { formatQuCompact } from "@/lib/format";
import type { DraftInputs, TxFilters } from "./history-utils";

export type ActiveFilterChip = {
  label: string;
  filters?: Partial<TxFilters>;
  draft?: Partial<DraftInputs>;
  clearGrouping?: boolean;
};

export function buildActiveFilterChips(filters: TxFilters, groupByCounterparty: boolean): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.direction !== "all") {
    chips.push({ label: filters.direction === "in" ? "Incoming" : "Outgoing", filters: { direction: "all" } });
  }
  if (filters.type !== "all") {
    chips.push({ label: filters.type === "sc" ? "SC calls" : "Transfers", filters: { type: "all" } });
  }
  if (filters.minAmount || filters.maxAmount) {
    const label = filters.minAmount && filters.maxAmount
      ? `${formatQuCompact(filters.minAmount)}–${formatQuCompact(filters.maxAmount)} QU`
      : filters.minAmount ? `≥ ${formatQuCompact(filters.minAmount)} QU` : `≤ ${formatQuCompact(filters.maxAmount)} QU`;
    chips.push({ label, filters: { minAmount: "", maxAmount: "" }, draft: { minAmount: "", maxAmount: "" } });
  }
  if (filters.dateFrom || filters.dateTo) {
    const label = filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} – ${filters.dateTo}`
      : filters.dateFrom ? `From ${filters.dateFrom}` : `To ${filters.dateTo}`;
    chips.push({ label, filters: { dateFrom: "", dateTo: "" }, draft: { dateFrom: "", dateTo: "" } });
  }
  if (filters.tickFrom || filters.tickTo) {
    const label = filters.tickFrom && filters.tickTo
      ? `Tick ${filters.tickFrom}–${filters.tickTo}`
      : filters.tickFrom ? `Tick ≥${filters.tickFrom}` : `Tick ≤${filters.tickTo}`;
    chips.push({ label, filters: { tickFrom: "", tickTo: "" }, draft: { tickFrom: "", tickTo: "" } });
  }
  if (groupByCounterparty) chips.push({ label: "Grouped", clearGrouping: true });
  return chips;
}
