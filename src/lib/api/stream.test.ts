import { describe, expect, test } from "bun:test";
import { configureApiClient } from "./client";
import { parseStreamEvent, parseStreamMarket, parseStreamTick, parseStreamTransaction, transactionStreamUrl } from "./stream";

describe("transaction stream helpers", () => {
  test("builds an identity-filtered transaction SSE URL against the configured origin", () => {
    configureApiClient("https://api.example");
    const url = new URL(transactionStreamUrl("BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK"));
    expect(url.origin).toBe("https://api.example");
    expect(url.pathname).toBe("/v1/stream");
    expect(url.searchParams.get("types")).toBe("transaction,event");
    expect(url.searchParams.get("identity")).toBe("BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK");
    configureApiClient("https://api.glyphq.org");
  });

  test("parses transaction frames and rejects malformed payloads", () => {
    expect(parseStreamTransaction(JSON.stringify({ hash: "h", source: "A", tick: 7 }))).toEqual({
      hash: "h",
      source: "A",
      destination: undefined,
      status: undefined,
      tick: 7,
      amount: undefined,
    });
    expect(parseStreamTransaction("not json")).toBeNull();
    expect(parseStreamTransaction(JSON.stringify({ source: "A" }))).toBeNull();
  });
});

describe("stream frame parsers", () => {
  test("parses decoded event and market frames", () => {
    expect(parseStreamEvent(JSON.stringify({ type_name: "qu_transfer", body: { from: "A" } }))).toMatchObject({
      type_name: "qu_transfer",
      body: { from: "A" },
    });
    expect(parseStreamTick(JSON.stringify({ tick: 9, epoch: 2 }))).toMatchObject({ tick: 9, epoch: 2 });
    expect(parseStreamMarket(JSON.stringify({ price_usd: 0.5, market_cap_usd: 10 }))).toMatchObject({
      price_usd: 0.5,
      market_cap_usd: 10,
    });
    expect(parseStreamTick("{}")).toBeNull();
    expect(parseStreamMarket(JSON.stringify({ price_usd: "bad" }))).toBeNull();
  });
});
