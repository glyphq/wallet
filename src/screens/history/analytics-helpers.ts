import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId } from "@/lib/format";
import type {
  ContractUsageStat,
  CounterpartyStat,
  DailyActivityStat,
  MonthlySummaryStat,
} from "@/lib/history-analytics";

const FMT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });

export function compactQu(value: bigint): string {
  return FMT.format(value);
}

export function incomingShare(incoming: bigint, outgoing: bigint): number {
  const total = incoming + outgoing;
  return total > 0n ? Number((incoming * 1000n) / total) / 10 : 50;
}

export type RankedItem = {
  id: string;
  kind: "identity" | "contract";
  primary: string;
  secondary: string;
  value: string;
};

export function buildCounterpartyItems(items: CounterpartyStat[]): RankedItem[] {
  return items.map((item) => ({
    id: item.identity,
    kind: "identity" as const,
    primary: KNOWN_CONTRACT_ADDRESSES[item.identity] ?? truncateId(item.identity, 8, 6),
    secondary: `${truncateId(item.identity, 6, 5)} · ${item.count} ${item.count === 1 ? "transaction" : "transactions"}`,
    value: `${compactQu(item.volume)} QU`,
  }));
}

export function buildContractItems(items: ContractUsageStat[]): RankedItem[] {
  return items.map((item) => ({
    id: item.contract,
    kind: "contract" as const,
    primary: item.contract,
    secondary: `${item.count} ${item.count === 1 ? "call" : "calls"} · smart contract`,
    value: `${compactQu(item.volume)} QU`,
  }));
}

export type MonthlyBar = {
  sortKey: number;
  month: string;
  count: number;
  incoming: bigint;
  outgoing: bigint;
  total: bigint;
  incomingWidth: number;
  outgoingWidth: number;
};

export function buildMonthlyBars(summaries: MonthlySummaryStat[], limit = 6): MonthlyBar[] {
  const visible = summaries.slice(-limit);
  const maxVolume = visible.reduce((maximum, summary) => {
    const total = summary.incoming + summary.outgoing;
    return total > maximum ? total : maximum;
  }, 0n);

  return visible.map((summary) => ({
    sortKey: summary.sortKey,
    month: summary.month,
    count: summary.count,
    incoming: summary.incoming,
    outgoing: summary.outgoing,
    total: summary.incoming + summary.outgoing,
    incomingWidth: maxVolume > 0n ? Number((summary.incoming * 1000n) / maxVolume) / 10 : 0,
    outgoingWidth: maxVolume > 0n ? Number((summary.outgoing * 1000n) / maxVolume) / 10 : 0,
  }));
}

export type HeatmapDay = { date: string; count: number };

export function buildActivityHeatmap(days: DailyActivityStat[], today = new Date()) {
  const max = Math.max(...days.map((day) => day.count), 1);
  const dayMap = new Map(days.map((day) => [day.date, day.count]));
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const cells: HeatmapDay[] = [];

  for (let offset = 83; offset >= 0; offset--) {
    const date = new Date(start);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    cells.push({ date: key, count: dayMap.get(key) ?? 0 });
  }

  const weeks = Array.from({ length: 12 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const totalTransactions = cells.reduce((total, cell) => total + cell.count, 0);

  return { weeks, activeDays, totalTransactions, max };
}
