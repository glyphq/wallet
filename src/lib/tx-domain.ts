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

/** Glyph API `Transaction` record. Amounts are JSON numbers but fit Qubic's supply range. */
interface ApiTransactionLike {
  hash?: string | null;
  source?: string | null;
  destination?: string | null;
  amount?: number | string | null;
  tick?: number | null;
  status?: string | null;
  timestamp?: string | null;
  input_type?: number | null;
}

/** Glyph API `Event` record; only decoded QU transfers map to history rows. */
interface ApiEventLike {
  tx_hash?: string | null;
  tick?: number | null;
  log_id?: number | null;
  type_name?: string | null;
  timestamp?: string | null;
  /** The service currently serializes decoded event bodies as JSON strings. */
  body?: unknown;
}

export function parseTimestamp(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const date = Date.parse(value);
    return Number.isFinite(date) ? date : null;
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

/** Maps a Glyph API transaction row into the UI record shape. */
export function normalizeApiTransaction(tx: ApiTransactionLike): TxRecord | null {
  if (!tx.hash) return null;
  return {
    hash: tx.hash,
    source: tx.source ?? null,
    destination: tx.destination ?? null,
    amount: tx.amount == null ? "0" : String(tx.amount),
    tickNumber: tx.tick ?? 0,
    moneyFlew: tx.status !== "failed",
    timestamp: parseTimestamp(tx.timestamp),
    inputType: tx.input_type ?? null,
    status: "confirmed",
  };
}

function parseEventBody(body: unknown): Record<string, unknown> | null {
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/** Maps a decoded QU-transfer event into a history row for contract-originated payouts. */
export function normalizeApiEvent(event: ApiEventLike): TxRecord | null {
  const body = parseEventBody(event.body);
  if (event.type_name !== "qu_transfer" || !body) return null;
  const from = typeof body.from === "string" ? body.from : null;
  const to = typeof body.to === "string" ? body.to : null;
  if (!from && !to) return null;
  const amount =
    typeof body.amount === "number" || typeof body.amount === "string"
      ? String(body.amount)
      : "0";
  const hash =
    event.tx_hash ||
    `event:${event.tick ?? 0}:${event.log_id ?? 0}`;
  return {
    hash,
    source: from,
    destination: to,
    amount,
    tickNumber: event.tick ?? 0,
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
