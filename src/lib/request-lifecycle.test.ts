import { describe, expect, test } from "bun:test";
import { completePendingRequest } from "@/lib/request-lifecycle";

describe("pending request lifecycle", () => {
  test("removes a request only after the response action resolves", async () => {
    const events: string[] = [];
    const result = await completePendingRequest(
      async () => {
        events.push("assembled-and-delivered");
        return "ok";
      },
      () => events.push("removed"),
    );
    expect(result).toBe("ok");
    expect(events).toEqual(["assembled-and-delivered", "removed"]);
  });

  test("keeps a request when response construction fails", async () => {
    const removed: string[] = [];
    await expect(completePendingRequest(
      async () => { throw new Error("native failure"); },
      () => removed.push("removed"),
    )).rejects.toThrow("native failure");
    expect(removed).toEqual([]);
  });
});
