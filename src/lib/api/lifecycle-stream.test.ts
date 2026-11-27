import { describe, expect, test } from "bun:test";
import { lifecycleLinkUrl, parseLifecycleProgress } from "./lifecycle-stream";

describe("transaction lifecycle stream", () => {
  test("reads the stream URL from the link envelope", () => {
    expect(lifecycleLinkUrl({
      data: { url: "https://api.glyphq.org/v1/lifecycle/stream?token=gll1.test" },
      meta: { scope: "lifecycle" },
    })).toBe("https://api.glyphq.org/v1/lifecycle/stream?token=gll1.test");
    expect(lifecycleLinkUrl({ data: {} })).toBeNull();
    expect(lifecycleLinkUrl(null)).toBeNull();
  });

  test("parses progress frames used by pending transaction resolution", () => {
    expect(parseLifecycleProgress(JSON.stringify({
      hash: "abc",
      state: "confirmed",
      target_tick: 100,
      included_tick: 99,
      current_tick: 101,
      money_flew: true,
      event_count: 3,
    }))).toEqual({
      hash: "abc",
      state: "confirmed",
      targetTick: 100,
      includedTick: 99,
      currentTick: 101,
      moneyFlew: true,
    });
  });

  test("rejects malformed progress frames", () => {
    expect(parseLifecycleProgress("not json")).toBeNull();
    expect(parseLifecycleProgress(JSON.stringify({ state: "confirmed" }))).toBeNull();
  });
});
