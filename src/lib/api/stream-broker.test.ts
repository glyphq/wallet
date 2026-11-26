import { afterAll, describe, expect, test } from "bun:test";
import { subscribeIdentityStreams, subscribeMarketStream, subscribeTickStream } from "./stream-broker";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  private listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    const event = { data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const originalEventSource = globalThis.EventSource;
// @ts-expect-error test double
globalThis.EventSource = FakeEventSource;

afterAll(() => {
  if (originalEventSource === undefined) {
    // @ts-expect-error restore absent global
    delete globalThis.EventSource;
  } else {
    globalThis.EventSource = originalEventSource;
  }
});

describe("stream broker", () => {
  test("shares one identity connection and dispatches parsed frames", () => {
    FakeEventSource.instances = [];
    const seen: string[] = [];
    const first = subscribeIdentityStreams("api:a", "IDENTITY", {
      onTransaction: (tx) => seen.push(`tx:${tx.hash}`),
      onEvent: (event) => seen.push(`event:${event.type_name}`),
    });
    const second = subscribeIdentityStreams("api:a", "IDENTITY", {
      onTransaction: (tx) => seen.push(`second:${tx.hash}`),
    });
    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0]!;
    expect(source.url).toContain("types=transaction%2Cevent");
    expect(source.url).toContain("identity=IDENTITY");

    source.emit("transaction", { hash: "H" });
    source.emit("event", { type_name: "qu_transfer", body: { from: "A" } });
    expect(seen).toEqual(["tx:H", "second:H", "event:qu_transfer"]);

    first();
    expect(source.closed).toBe(false);
    second();
    expect(source.closed).toBe(true);
  });

  test("shares tick and market connections", () => {
    FakeEventSource.instances = [];
    const ticks: number[] = [];
    const markets: number[] = [];
    const stopTickA = subscribeTickStream("api:a", (tick) => ticks.push(tick.tick));
    const stopTickB = subscribeTickStream("api:a", (tick) => ticks.push(tick.tick));
    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0]!.emit("tick", { tick: 7 });
    expect(ticks).toEqual([7, 7]);
    stopTickA();
    stopTickB();
    expect(FakeEventSource.instances[0]!.closed).toBe(true);

    const stopMarket = subscribeMarketStream("api:a", {
      onMarket: (market) => markets.push(market.price_usd),
    });
    FakeEventSource.instances[1]!.emit("market", { price_usd: 0.25 });
    expect(markets).toEqual([0.25]);
    stopMarket();
  });
});
