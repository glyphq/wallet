import { describe, expect, test } from "bun:test";
import { drainPendingRequests } from "@/lib/pending-request-queue";

describe("native pending request drain", () => {
  test("accepts queued payloads strictly in FIFO order", async () => {
    const nativeQueue = ["first", "second"];
    const accepted: string[] = [];

    await drainPendingRequests({
      getPendingRequest: async () => nativeQueue[0] ?? null,
      acceptPendingRequest: async (payload) => {
        expect(payload).toBe(nativeQueue[0]);
        nativeQueue.shift(); // Simulates guarded native clear of this exact head.
        return { accepted: true, shouldRetainPending: false };
      },
      onAccepted: (payload) => { accepted.push(payload); },
    });

    expect(accepted).toEqual(["first", "second"]);
    expect(nativeQueue).toEqual([]);
  });

  test("leaves a wrong-network head and later requests untouched", async () => {
    const nativeQueue = ["wrong-network", "next"];
    const accepted: string[] = [];

    await drainPendingRequests({
      getPendingRequest: async () => nativeQueue[0] ?? null,
      acceptPendingRequest: async () => ({ accepted: false, shouldRetainPending: true }),
      onAccepted: (payload) => { accepted.push(payload); },
    });

    expect(accepted).toEqual([]);
    expect(nativeQueue).toEqual(["wrong-network", "next"]);
  });
});
