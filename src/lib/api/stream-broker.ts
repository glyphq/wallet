import {
  marketStreamUrl,
  parseStreamEvent,
  parseStreamMarket,
  parseStreamPrice,
  parseStreamTick,
  parseStreamTransaction,
  tickStreamUrl,
  transactionStreamUrl,
  type StreamEventRecord,
  type StreamMarket,
  type StreamPrice,
  type StreamTick,
  type StreamTransaction,
} from "./stream";

export interface IdentityStreamListener {
  onTransaction?: (transaction: StreamTransaction) => void;
  onEvent?: (event: StreamEventRecord) => void;
  onOpen?: () => void;
  onLag?: () => void;
}

export interface MarketStreamListener {
  onMarket?: (market: StreamMarket) => void;
  onPrice?: (price: StreamPrice) => void;
  onOpen?: () => void;
  onLag?: () => void;
}

interface IdentityRoom {
  apiKey: string;
  source: EventSource;
  listeners: Set<IdentityStreamListener>;
}

interface TickRoom {
  apiKey: string;
  source: EventSource;
  listeners: Set<(tick: StreamTick) => void>;
}

interface MarketRoom {
  apiKey: string;
  source: EventSource;
  listeners: Set<MarketStreamListener>;
}

const identityRooms = new Map<string, IdentityRoom>();
let tickRoom: TickRoom | null = null;
let marketRoom: MarketRoom | null = null;

function canStream(): boolean {
  return typeof EventSource !== "undefined";
}

function messageData(event: Event): string {
  return (event as MessageEvent<string>).data;
}

/** Subscribes to one identity's transaction and event feed, sharing one SSE connection. */
export function subscribeIdentityStreams(
  apiKey: string,
  identity: string,
  listener: IdentityStreamListener,
): () => void {
  if (!canStream()) return () => {};
  const key = `${apiKey}\n${identity}`;
  let room = identityRooms.get(key);
  if (!room) {
    const source = new EventSource(transactionStreamUrl(identity));
    room = { apiKey, source, listeners: new Set() };
    source.addEventListener("open", () => {
      for (const item of room!.listeners) item.onOpen?.();
    });
    source.addEventListener("lag", () => {
      for (const item of room!.listeners) item.onLag?.();
    });
    source.addEventListener("transaction", (event) => {
      const transaction = parseStreamTransaction(messageData(event));
      if (!transaction) return;
      for (const item of room!.listeners) item.onTransaction?.(transaction);
    });
    source.addEventListener("event", (event) => {
      const parsed = parseStreamEvent(messageData(event));
      if (!parsed) return;
      for (const item of room!.listeners) item.onEvent?.(parsed);
    });
    identityRooms.set(key, room);
  }
  room.listeners.add(listener);

  return () => {
    const active = identityRooms.get(key);
    if (!active) return;
    active.listeners.delete(listener);
    if (active.listeners.size === 0) {
      active.source.close();
      identityRooms.delete(key);
    }
  };
}

/** Subscribes to indexed tick headers, sharing one SSE connection. */
export function subscribeTickStream(apiKey: string, listener: (tick: StreamTick) => void): () => void {
  if (!canStream()) return () => {};
  if (!tickRoom || tickRoom.apiKey !== apiKey) {
    tickRoom?.source.close();
    const source = new EventSource(tickStreamUrl());
    const room: TickRoom = { apiKey, source, listeners: new Set() };
    source.addEventListener("tick", (event) => {
      const tick = parseStreamTick(messageData(event));
      if (!tick) return;
      for (const item of room.listeners) item(tick);
    });
    tickRoom = room;
  }
  const active = tickRoom;
  active.listeners.add(listener);
  return () => {
    if (tickRoom !== active) return;
    active.listeners.delete(listener);
    if (active.listeners.size === 0) {
      active.source.close();
      tickRoom = null;
    }
  };
}

/** Subscribes to price and market snapshots, sharing one SSE connection. */
export function subscribeMarketStream(apiKey: string, listener: MarketStreamListener): () => void {
  if (!canStream()) return () => {};
  if (!marketRoom || marketRoom.apiKey !== apiKey) {
    marketRoom?.source.close();
    const source = new EventSource(marketStreamUrl());
    const room: MarketRoom = { apiKey, source, listeners: new Set() };
    source.addEventListener("open", () => {
      for (const item of room.listeners) item.onOpen?.();
    });
    source.addEventListener("lag", () => {
      for (const item of room.listeners) item.onLag?.();
    });
    source.addEventListener("market", (event) => {
      const market = parseStreamMarket(messageData(event));
      if (!market) return;
      for (const item of room.listeners) item.onMarket?.(market);
    });
    source.addEventListener("price", (event) => {
      const price = parseStreamPrice(messageData(event));
      if (!price) return;
      for (const item of room.listeners) item.onPrice?.(price);
    });
    marketRoom = room;
  }
  const active = marketRoom;
  active.listeners.add(listener);
  return () => {
    if (marketRoom !== active) return;
    active.listeners.delete(listener);
    if (active.listeners.size === 0) {
      active.source.close();
      marketRoom = null;
    }
  };
}
