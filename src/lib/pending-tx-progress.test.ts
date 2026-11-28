import { describe, expect, test } from "bun:test";
import { etaSecondsFromTicks, networkTicksPerSecond, pendingTxProgress } from "./pending-tx-progress";

describe("pendingTxProgress", () => {
  test("counts ticks down to the target tick", () => {
    expect(pendingTxProgress(100, 94)).toMatchObject({
      phase: "waiting",
      remainingTicks: 6,
      label: "Pending",
      timingText: "6 ticks to target",
    });
  });

  test("shows the confirmation grace after the target tick", () => {
    expect(pendingTxProgress(100, 100)).toMatchObject({
      phase: "confirming",
      remainingTicks: 0,
      ticksToExpiry: 30,
      label: "Confirming",
    });
    expect(pendingTxProgress(100, 125).timingText).toBe("Awaiting confirmation · 5 ticks to expiry");
  });

  test("expires only after the grace window", () => {
    expect(pendingTxProgress(100, 130).phase).toBe("confirming");
    expect(pendingTxProgress(100, 131)).toMatchObject({
      phase: "expired",
      label: "Failed",
      timingText: "Expired at tick 130",
    });
  });

  test("handles an unknown current tick", () => {
    expect(pendingTxProgress(100, 0)).toMatchObject({
      phase: "waiting",
      timingText: "Target tick 100",
    });
  });
});

describe("networkTicksPerSecond", () => {
  test("prefers the observed rate", () => {
    expect(networkTicksPerSecond(2.5, 1000)).toBe(2.5);
  });

  test("falls back to peer duration in milliseconds", () => {
    expect(networkTicksPerSecond(null, 500)).toBe(2);
    expect(networkTicksPerSecond(0, 250)).toBe(4);
  });

  test("falls back to three ticks per second", () => {
    expect(networkTicksPerSecond(null, 0)).toBe(3);
  });
});

describe("etaSecondsFromTicks", () => {
  test("converts remaining ticks using the observed rate", () => {
    expect(etaSecondsFromTicks(10, 1)).toBe(10);
    expect(etaSecondsFromTicks(10, 3)).toBe(4);
    expect(etaSecondsFromTicks(10, 4)).toBe(3);
  });

  test("returns zero at or past the target tick", () => {
    expect(etaSecondsFromTicks(0, 3)).toBe(0);
    expect(etaSecondsFromTicks(-2, 3)).toBe(0);
  });

  test("returns null without a usable rate", () => {
    expect(etaSecondsFromTicks(10, 0)).toBeNull();
    expect(etaSecondsFromTicks(10, Number.NaN)).toBeNull();
  });
});
