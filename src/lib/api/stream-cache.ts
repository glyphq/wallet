import type { GetStatusResponse } from "./generated";
import type { StreamTick } from "./stream";

/** Applies an indexed tick frame to the cached status document without polling. */
export function applyTickToStatus(
  previous: GetStatusResponse | undefined,
  tick: StreamTick,
): GetStatusResponse {
  if (!previous?.data) {
    return {
      data: {
        head: {
          tick: tick.tick,
          epoch: tick.epoch,
          timestamp: tick.timestamp,
          transaction_count: tick.transaction_count,
          event_count: tick.event_count,
        },
        network: {
          head: tick.tick,
          epoch: tick.epoch,
          reachable: true,
        },
        ingest_status: {
          last_indexed_tick: tick.tick,
        },
      },
      meta: {},
    };
  }
  const status = previous.data;
  return {
    ...previous,
    data: {
      ...status,
      head: {
        ...status.head,
        tick: tick.tick,
        epoch: tick.epoch ?? status.head?.epoch,
        timestamp: tick.timestamp ?? status.head?.timestamp,
        transaction_count: tick.transaction_count ?? status.head?.transaction_count,
        event_count: tick.event_count ?? status.head?.event_count,
      },
      network: {
        ...status.network,
        head: tick.tick,
        epoch: tick.epoch ?? status.network?.epoch,
        reachable: true,
      },
      ingest_status: {
        ...status.ingest_status,
        last_indexed_tick: tick.tick,
      },
    },
  };
}
