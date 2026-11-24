import { describe, expect, test } from "bun:test";
import { applyTickToStatus } from "./stream-cache";

describe("applyTickToStatus", () => {
  test("advances head and ingest fields without dropping status metadata", () => {
    const next = applyTickToStatus(
      {
        data: {
          head: { tick: 10, epoch: 1 },
          network: { head: 11, epoch: 1, reachable: false, tick_duration: 1 },
          ingest_status: { last_indexed_tick: 9, lag_ticks: 2 },
        },
      },
      { tick: 12, epoch: 1, transaction_count: 5, event_count: 7 },
    );

    expect(next.data?.head?.tick).toBe(12);
    expect(next.data?.head?.transaction_count).toBe(5);
    expect(next.data?.network?.head).toBe(12);
    expect(next.data?.network?.reachable).toBe(true);
    expect(next.data?.network?.tick_duration).toBe(1);
    expect(next.data?.ingest_status?.last_indexed_tick).toBe(12);
  });

  test("creates a minimal status document before the initial fetch resolves", () => {
    const next = applyTickToStatus(undefined, { tick: 42, epoch: 3 });
    expect(next.data?.network).toMatchObject({ head: 42, epoch: 3, reachable: true });
    expect(next.data?.ingest_status?.last_indexed_tick).toBe(42);
  });
});
