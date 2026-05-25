import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import type { PendingTx } from "@/store/persisted";

export interface TxRecord {
  hash: string;
  source: string | null;
  destination: string | null;
  amount: string;
  tickNumber: number;
  moneyFlew: boolean;
  timestamp: number | null;
  inputType: number | null;
  status: "pending" | "confirmed";
  contractName?: string;
}

interface ArchiveTransactionLike {
  hash?: string | null;
  source?: string | null;
  destination?: string | null;
  amount?: string | null;
  tickNumber?: number | null;
  moneyFlew?: boolean | null;
  timestamp?: string | number | null;
  inputType?: number | null;
}

interface EventLogTransferLike {
  transactionHash?: string | null;
  tickNumber?: number | null;
  timestamp?: string | number | null;
  quTransfer?: {
    source?: string | null;
    destination?: string | null;
    amount?: string | null;
  } | null;
}

export function parseTimestamp(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeArchiveTransaction(tx: ArchiveTransactionLike): TxRecord | null {
  if (!tx.hash) return null;
  return {
    hash: tx.hash,
    source: tx.source ?? null,
    destination: tx.destination ?? null,
    amount: tx.amount ?? "0",
    tickNumber: tx.tickNumber ?? 0,
    moneyFlew: tx.moneyFlew ?? true,
    timestamp: parseTimestamp(tx.timestamp),
    inputType: tx.inputType ?? null,
    status: "confirmed",
  };
}

export function normalizeEventTransfer(event: EventLogTransferLike): TxRecord | null {
  if (!event.transactionHash || !event.quTransfer) return null;
  return {
    hash: event.transactionHash,
    source: event.quTransfer.source ?? null,
    destination: event.quTransfer.destination ?? null,
    amount: event.quTransfer.amount ?? "0",
    tickNumber: event.tickNumber ?? 0,
    moneyFlew: true,
    timestamp: parseTimestamp(event.timestamp),
    inputType: null,
    status: "confirmed",
  };
}

export function pendingTxToRecord(tx: PendingTx): TxRecord {
  return {
    hash: tx.hash,
    source: tx.source,
    destination: tx.destination,
    amount: tx.amount,
    tickNumber: tx.targetTick,
    moneyFlew: true,
    timestamp: tx.broadcastAt,
    inputType: null,
    status: "pending",
    contractName: tx.contractName,
  };
}

export function dedupeTxRecords<T extends { hash: string }>(items: T[]): T[] {
  const byHash = new Map<string, T>();
  for (const item of items) {
    if (!byHash.has(item.hash)) byHash.set(item.hash, item);
  }
  return [...byHash.values()];
}

export function sortTxRecords<T extends { tickNumber: number; timestamp: number | null }>(items: T[]): T[] {
  return items
    .slice()
    .sort((a, b) => (b.tickNumber === a.tickNumber ? (b.timestamp ?? 0) - (a.timestamp ?? 0) : b.tickNumber - a.tickNumber));
}

export function isKnownContract(address: string | null | undefined): boolean {
  return !!(address && KNOWN_CONTRACT_ADDRESSES[address]);
}

export function getKnownContractLabel(address: string | null | undefined): string {
  return address ? KNOWN_CONTRACT_ADDRESSES[address] ?? "" : "";
}
