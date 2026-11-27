import { describe, expect, test } from "bun:test";
import { resolutionFromLifecycle, resolutionFromLifecycleProgress } from "./tx-resolution";

const lifecycle = (state: string, extra: Record<string, unknown> = {}) => ({
  data: { state, ...extra },
});

describe("resolutionFromLifecycle", () => {
  test("treats confirmed with an unknown money-flow verdict as confirmed", () => {
    expect(resolutionFromLifecycle("h", lifecycle("confirmed", { included_tick: 9, money_flew: null })))
      .toEqual({ hash: "h", status: "confirmed", moneyFlew: null, includedTick: 9 });
  });

  test("marks confirmed without money movement as failed", () => {
    expect(resolutionFromLifecycle("h", lifecycle("confirmed", { money_flew: false }))?.status).toBe("failed");
  });

  test("maps tracker failures and expiries to terminal states", () => {
    expect(resolutionFromLifecycle("h", lifecycle("failed"))?.status).toBe("failed");
    expect(resolutionFromLifecycle("h", lifecycle("expired"))?.status).toBe("expired");
    expect(resolutionFromLifecycle("h", lifecycle("missed"))?.status).toBe("expired");
  });

  test("resolves terminal lifecycle stream progress", () => {
    expect(resolutionFromLifecycleProgress("h", {
      state: "confirmed",
      moneyFlew: true,
      includedTick: 42,
    })).toEqual({ hash: "h", status: "confirmed", moneyFlew: true, includedTick: 42 });
    expect(resolutionFromLifecycleProgress("h", {
      state: "cancelled",
      moneyFlew: null,
      includedTick: null,
    })?.status).toBe("expired");
  });

  test("leaves in-flight states unresolved", () => {
    for (const state of ["queued", "broadcast", "pending", "unknown"]) {
      expect(resolutionFromLifecycle("h", lifecycle(state))).toBeNull();
    }
    expect(resolutionFromLifecycle("h", null)).toBeNull();
    expect(resolutionFromLifecycle("h", { data: {} })).toBeNull();
  });
});
