import { describe, expect, test } from "bun:test";
import { pendingTxProgress } from "./pending-tx-progress";

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
