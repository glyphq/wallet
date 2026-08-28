import { describe, expect, test } from "bun:test";
import { drainPendingRequests, retryDeferredRequests } from "@/lib/pending-request-queue";

describe("native pending request drain", () => {
  test("accepts queued payloads strictly in FIFO order", async () => {
    const nativeQueue = ["first", "second"];
    const accepted: string[] = [];
    await drainPendingRequests({
      getPendingRequest: async () => nativeQueue[0] ?? null,
      acceptPendingRequest: async (payload) => {
        expect(payload).toBe(nativeQueue[0]); nativeQueue.shift();
        return { accepted: true, shouldRetainPending: false };
      },
      onAccepted: (payload) => { accepted.push(payload); },
    });
    expect(accepted).toEqual(["first", "second"]);
  });

  test("defers a wrong-network head and continues with later requests", async () => {
    const nativeQueue = ["wrong-network", "next"];
    const accepted: string[] = [];
    const deferred: string[] = [];
    await drainPendingRequests({
      getPendingRequest: async () => nativeQueue[0] ?? null,
      acceptPendingRequest: async (payload) => {
        nativeQueue.shift();
        return payload === "wrong-network"
          ? { accepted: false, shouldRetainPending: false, deferredForNetworkSwitch: true }
          : { accepted: true, shouldRetainPending: false };
      },
      onAccepted: (payload) => { accepted.push(payload); },
      onDeferred: (payload) => { deferred.push(payload); },
    });
    expect(deferred).toEqual(["wrong-network"]);
    expect(accepted).toEqual(["next"]);
  });

  test("retained deferred requests become actionable only after a matching switch", async () => {
    const accepted: string[] = [];
    let matches = false;
    // Use the public deferral path through a drain.
    const queue = ["switch-me"];
    const { deferPendingRequest } = await import("@/lib/pending-request-queue");
    deferPendingRequest(queue[0]);
    await retryDeferredRequests(async () => matches, (payload) => { accepted.push(payload); });
    expect(accepted).toEqual([]);
    matches = true;
    await retryDeferredRequests(async () => matches, (payload) => { accepted.push(payload); });
    expect(accepted).toContain("switch-me");
  });
});
