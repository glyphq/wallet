import { getApiBaseUrl } from "./client";

export interface StreamTransaction {
  hash: string;
  source?: string;
  destination?: string;
  status?: string;
  tick?: number;
  amount?: number;
}

/** SSE URL for indexed transactions and events touching `identity`. */
export function transactionStreamUrl(identity: string): string {
  const url = new URL("/v1/stream", getApiBaseUrl());
  url.searchParams.set("types", "transaction,event");
  url.searchParams.set("identity", identity);
  return url.toString();
}

export function tickStreamUrl(): string {
  return new URL("/v1/stream/ticks", getApiBaseUrl()).toString();
}

export function marketStreamUrl(): string {
  const url = new URL("/v1/stream", getApiBaseUrl());
  url.searchParams.set("types", "price,market");
  return url.toString();
}

/** Parses one `transaction` SSE frame; returns null for malformed payloads. */
export function parseStreamTransaction(raw: string): StreamTransaction | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.hash !== "string" || !record.hash) return null;
    return {
      hash: record.hash,
      source: typeof record.source === "string" ? record.source : undefined,
      destination: typeof record.destination === "string" ? record.destination : undefined,
      status: typeof record.status === "string" ? record.status : undefined,
      tick: typeof record.tick === "number" ? record.tick : undefined,
      amount: typeof record.amount === "number" ? record.amount : undefined,
    };
  } catch {
    return null;
  }
}

export interface StreamEventRecord {
  type_name?: string;
  tx_hash?: string;
  tick?: number;
  log_id?: number;
  timestamp?: string;
  body?: unknown;
}

export interface StreamTick {
  tick: number;
  epoch?: number;
  timestamp?: string;
  transaction_count?: number;
  event_count?: number;
}

export interface StreamMarket {
  price_usd: number;
  market_cap_usd?: number | null;
  change_24h_percent?: number | null;
  fetched_at?: string;
}

export interface StreamPrice {
  price_usdt?: number;
  price_e8?: number;
  timestamp?: string;
}

function parseRecord(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function parseStreamEvent(raw: string): StreamEventRecord | null {
  const record = parseRecord(raw);
  if (!record) return null;
  return {
    type_name: typeof record.type_name === "string" ? record.type_name : undefined,
    tx_hash: typeof record.tx_hash === "string" ? record.tx_hash : undefined,
    tick: typeof record.tick === "number" ? record.tick : undefined,
    log_id: typeof record.log_id === "number" ? record.log_id : undefined,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
    body: record.body,
  };
}

export function parseStreamTick(raw: string): StreamTick | null {
  const record = parseRecord(raw);
  if (!record || typeof record.tick !== "number") return null;
  return {
    tick: record.tick,
    epoch: typeof record.epoch === "number" ? record.epoch : undefined,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
    transaction_count: typeof record.transaction_count === "number" ? record.transaction_count : undefined,
    event_count: typeof record.event_count === "number" ? record.event_count : undefined,
  };
}

export function parseStreamMarket(raw: string): StreamMarket | null {
  const record = parseRecord(raw);
  if (!record || typeof record.price_usd !== "number") return null;
  return {
    price_usd: record.price_usd,
    market_cap_usd: typeof record.market_cap_usd === "number" ? record.market_cap_usd : null,
    change_24h_percent: typeof record.change_24h_percent === "number" ? record.change_24h_percent : null,
    fetched_at: typeof record.fetched_at === "string" ? record.fetched_at : undefined,
  };
}

export function parseStreamPrice(raw: string): StreamPrice | null {
  const record = parseRecord(raw);
  if (!record) return null;
  if (typeof record.price_usdt !== "number" && typeof record.price_e8 !== "number") return null;
  return {
    price_usdt: typeof record.price_usdt === "number" ? record.price_usdt : undefined,
    price_e8: typeof record.price_e8 === "number" ? record.price_e8 : undefined,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
  };
}
