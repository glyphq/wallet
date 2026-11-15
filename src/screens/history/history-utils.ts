import { DEFAULT_QUERY_FILTERS, type TxHistoryItem, type TxQueryFilters } from "@/hooks/use-tx-history";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import type { PendingTx } from "@/store/persisted";

export type TxFilters = TxQueryFilters;

export const DEFAULT_FILTERS: TxFilters = { ...DEFAULT_QUERY_FILTERS };

export const INITIAL_VISIBLE_HISTORY_ROWS = 150;
export const HISTORY_RENDER_PAGE = 100;

// Draft state for text inputs, committed on Apply
export type DraftInputs = {
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  tickFrom: string;
  tickTo: string;
};

export function toDraft(f: TxFilters): DraftInputs {
  return { minAmount: f.minAmount, maxAmount: f.maxAmount, dateFrom: f.dateFrom, dateTo: f.dateTo, tickFrom: f.tickFrom, tickTo: f.tickTo };
}

export function sanitize(s: string): string {
  const n = s.trim();
  return n && /^\d+$/.test(n) && Number(n) > 0 ? n : "";
}

export function isDefault(f: TxFilters): boolean {
  return (
    f.direction === "all" && f.type === "all" &&
    !f.minAmount && !f.maxAmount && !f.dateFrom && !f.dateTo && !f.tickFrom && !f.tickTo
  );
}

export type TxSection = { label: string; txs: TxHistoryItem[] };

export type ExportTx = {
  hash: string;
  status: "confirmed" | "pending" | "expired";
  direction: "in" | "out" | "self" | "unknown";
  type: "transfer" | "contract";
  source: string | null;
  destination: string | null;
  amount: string;
  tick: number;
  timestamp: number | null;
  isoDate: string;
  moneyFlew: boolean | null;
  inputType: number | null;
  contractName: string;
  memo: string;
  tags: string[];
};

export function groupTxsByDate(txs: TxHistoryItem[]): TxSection[] {
  if (!txs.length) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();

  const today: TxHistoryItem[] = [];
  const yesterday: TxHistoryItem[] = [];
  const thisWeek: TxHistoryItem[] = [];
  const earlier: TxHistoryItem[] = [];

  for (const tx of txs) {
    const ts = tx.timestamp ?? 0;
    if (ts >= todayStart) today.push(tx);
    else if (ts >= yesterdayStart) yesterday.push(tx);
    else if (ts >= weekStart) thisWeek.push(tx);
    else earlier.push(tx);
  }

  const sections: TxSection[] = [];
  if (today.length) sections.push({ label: "Today", txs: today });
  if (yesterday.length) sections.push({ label: "Yesterday", txs: yesterday });
  if (thisWeek.length) sections.push({ label: "This week", txs: thisWeek });
  if (earlier.length) sections.push({ label: "Earlier", txs: earlier });
  return sections;
}

export function downloadText(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | boolean | null | string[]): string {
  const text = Array.isArray(value) ? value.join(";") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ExportTx[]): string {
  const headers: (keyof ExportTx)[] = ["hash", "status", "direction", "type", "source", "destination", "amount", "tick", "timestamp", "isoDate", "moneyFlew", "inputType", "contractName", "memo", "tags"];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}

export function matchesPendingFilters(tx: PendingTx, filters: TxFilters, identity: string | null): boolean {
  if (filters.direction === "in" && tx.destination !== identity) return false;
  if (filters.direction === "out" && tx.source !== identity) return false;
  if (filters.type === "transfer" && tx.contractName) return false;
  if (filters.type === "sc" && !tx.contractName) return false;
  try {
    const amount = BigInt(tx.amount || "0");
    if (filters.minAmount && amount < BigInt(filters.minAmount)) return false;
    if (filters.maxAmount && amount > BigInt(filters.maxAmount)) return false;
  } catch { return false; }
  if (filters.tickFrom && tx.targetTick < Number(filters.tickFrom)) return false;
  if (filters.tickTo && tx.targetTick > Number(filters.tickTo)) return false;
  if (filters.dateFrom && tx.broadcastAt < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
  if (filters.dateTo && tx.broadcastAt > new Date(`${filters.dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

function txDirection(source: string | null, destination: string | null, identity: string | null): ExportTx["direction"] {
  if (!identity) return "unknown";
  if (source === identity && destination === identity) return "self";
  if (destination === identity) return "in";
  if (source === identity) return "out";
  return "unknown";
}

export function exportRecordFromTx(tx: TxHistoryItem, identity: string | null, txMemos: Record<string, string>, txTags: Record<string, string[]>): ExportTx {
  const contractName = tx.contractName ?? (tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined) ?? (tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined) ?? "";
  return {
    hash: tx.hash,
    status: "confirmed",
    direction: txDirection(tx.source, tx.destination, identity),
    type: contractName || (tx.inputType ?? 0) > 0 ? "contract" : "transfer",
    source: tx.source,
    destination: tx.destination,
    amount: tx.amount,
    tick: tx.tickNumber,
    timestamp: tx.timestamp,
    isoDate: tx.timestamp ? new Date(tx.timestamp).toISOString() : "",
    moneyFlew: tx.moneyFlew,
    inputType: tx.inputType,
    contractName,
    memo: txMemos[tx.hash]?.trim() ?? "",
    tags: txTags[tx.hash] ?? [],
  };
}

export function exportRecordFromPending(tx: PendingTx, identity: string | null, txMemos: Record<string, string>, txTags: Record<string, string[]>, expired: boolean): ExportTx {
  return {
    hash: tx.hash,
    status: expired ? "expired" : "pending",
    direction: txDirection(tx.source, tx.destination, identity),
    type: tx.contractName ? "contract" : "transfer",
    source: tx.source,
    destination: tx.destination,
    amount: tx.amount,
    tick: tx.targetTick,
    timestamp: tx.broadcastAt,
    isoDate: tx.broadcastAt ? new Date(tx.broadcastAt).toISOString() : "",
    moneyFlew: null,
    inputType: null,
    contractName: tx.contractName ?? "",
    memo: txMemos[tx.hash]?.trim() ?? "",
    tags: txTags[tx.hash] ?? [],
  };
}
