import { describe, expect, test } from "bun:test";
import { normalizeCoreLiteRpcBody, normalizeCoreLiteRpcPayload } from "./core-lite-rpc-compat";

describe("core-lite RPC compatibility", () => {
  test("moves all core-lite tick info fields under tickInfo", () => {
    expect(
      normalizeCoreLiteRpcPayload("/live/v1/tick-info", {
        epoch: 140,
        tick: 24_000_123,
        initialTick: 24_000_000,
        duration: 0,
        alignedVotes: 450,
        tickInfo: { tick: 24_000_123 },
      }),
    ).toEqual({
      tickInfo: {
        epoch: 140,
        tick: 24_000_123,
        initialTick: 24_000_000,
        duration: 0,
        alignedVotes: 450,
      },
    });
  });

  test("maps core-lite last processed tick to an explicit log tick", () => {
    expect(
      normalizeCoreLiteRpcPayload("/query/v1/getLastProcessedTick", {
        tickNumber: 1234,
        epoch: 7,
        intervalInitialTick: 1200,
      }),
    ).toEqual({
      tickNumber: 1234,
      epoch: 7,
      intervalInitialTick: 1200,
      logTickNumber: 1234,
    });

    expect(
      normalizeCoreLiteRpcPayload("/query/v1/getLastProcessedTick", {
        tickNumber: 1234,
        logTickNumber: 1230,
      }),
    ).toEqual({ tickNumber: 1234, logTickNumber: 1230 });
  });

  test("wraps only the known flat query responses", () => {
    const intervals = [{ epoch: 7, firstTick: 1200, lastTick: 1234 }];
    expect(normalizeCoreLiteRpcPayload("/query/v1/getProcessedTickIntervals", intervals)).toEqual({
      processedTickIntervals: intervals,
    });
    expect(normalizeCoreLiteRpcPayload("/query/v1/getTickData", { tickNumber: 1234 })).toEqual({
      tickData: { tickNumber: 1234 },
    });
    expect(normalizeCoreLiteRpcPayload("/query/v1/getTransactionByHash", { tickNumber: 1234 })).toEqual({
      transaction: { tickNumber: 1234 },
    });
  });

  test("does not double-wrap public-compatible or unrelated payloads", () => {
    const tickData = { tickData: { tickNumber: 1234 } };
    const transaction = { transaction: { tickNumber: 1234 } };
    const unrelated = { ownedAssets: [] };
    expect(normalizeCoreLiteRpcPayload("/query/v1/getTickData", tickData)).toBe(tickData);
    expect(normalizeCoreLiteRpcPayload("/query/v1/getTransactionByHash", transaction)).toBe(transaction);
    expect(normalizeCoreLiteRpcPayload("/live/v1/assets/ABC/owned", unrelated)).toBe(unrelated);
  });

  test("leaves invalid JSON bodies unchanged", () => {
    expect(normalizeCoreLiteRpcBody("/live/v1/tick-info", "not-json")).toBe("not-json");
    expect(normalizeCoreLiteRpcBody("/live/v1/tick-info", "")).toBe("");
  });
});
