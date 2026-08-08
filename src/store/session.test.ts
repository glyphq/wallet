import { describe, expect, test } from "bun:test";
import { MAX_PENDING_REQUESTS, useSessionStore } from "./session";

describe("pending request queue", () => {
  test("retains a bounded window of the newest requests", () => {
    useSessionStore.setState({ pendingRequests: [] });
    const { enqueuePendingRequest } = useSessionStore.getState();

    for (let index = 0; index < MAX_PENDING_REQUESTS + 2; index++) {
      enqueuePendingRequest(`request-${index}`);
    }

    expect(useSessionStore.getState().pendingRequests).toEqual(
      Array.from({ length: MAX_PENDING_REQUESTS }, (_, index) => `request-${index + 2}`),
    );
  });
});
