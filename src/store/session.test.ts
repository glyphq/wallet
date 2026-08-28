import { describe, expect, test } from "bun:test";
import { MAX_PENDING_REQUESTS, useSessionStore } from "./session";
import { completePendingRequest } from "@/lib/request-lifecycle";

describe("pending request queue", () => {
  test("preserves the oldest queued requests at capacity", () => {
    useSessionStore.setState({ pendingRequests: [] });
    const { enqueuePendingRequest } = useSessionStore.getState();

    for (let index = 0; index < MAX_PENDING_REQUESTS + 2; index++) {
      enqueuePendingRequest(`request-${index}`);
    }

    expect(useSessionStore.getState().pendingRequests).toEqual(
      Array.from({ length: MAX_PENDING_REQUESTS }, (_, index) => `request-${index}`),
    );
  });

  test("shows two distinct requests in FIFO order after completion", async () => {
    useSessionStore.setState({ pendingRequests: [] });
    const { enqueuePendingRequest, shiftPendingRequest } = useSessionStore.getState();
    enqueuePendingRequest("first-request");
    enqueuePendingRequest("second-request");

    expect(useSessionStore.getState().pendingRequests[0]).toBe("first-request");
    await completePendingRequest(async () => "approved", shiftPendingRequest);
    expect(useSessionStore.getState().pendingRequests).toEqual(["second-request"]);
  });

  test("does not queue a duplicate request", () => {
    useSessionStore.setState({ pendingRequests: [] });
    const { enqueuePendingRequest } = useSessionStore.getState();
    enqueuePendingRequest("same-request");
    enqueuePendingRequest("same-request");

    expect(useSessionStore.getState().pendingRequests).toEqual(["same-request"]);
  });

  test("both approval and rejection advance exactly one request", async () => {
    useSessionStore.setState({ pendingRequests: ["approve", "reject", "next"] });
    const { shiftPendingRequest } = useSessionStore.getState();

    await completePendingRequest(async () => "approved", shiftPendingRequest);
    expect(useSessionStore.getState().pendingRequests).toEqual(["reject", "next"]);
    await completePendingRequest(async () => "rejected", shiftPendingRequest);
    expect(useSessionStore.getState().pendingRequests).toEqual(["next"]);
  });

  test("a completion error retains the active request and its successor", async () => {
    useSessionStore.setState({ pendingRequests: ["active", "next"] });
    const { shiftPendingRequest } = useSessionStore.getState();

    await expect(completePendingRequest(
      async () => { throw new Error("delivery failed"); },
      shiftPendingRequest,
    )).rejects.toThrow("delivery failed");

    expect(useSessionStore.getState().pendingRequests).toEqual(["active", "next"]);
  });
});
