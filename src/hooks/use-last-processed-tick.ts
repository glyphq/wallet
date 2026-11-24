import { useMemo } from "react";
import { useTickInfo } from "@/hooks/use-tick-info";

/** Index head derived from the tick stream; kept as a separate shape for existing callers. */
export function useLastProcessedTick() {
  const query = useTickInfo();
  const data = useMemo(
    () => query.data && query.data.tick > 0
      ? {
          tickNumber: query.data.tick,
          epoch: query.data.epoch,
          intervalInitialTick: query.data.initialTick ?? 0,
          logTickNumber: query.data.tick,
        }
      : undefined,
    [query.data],
  );
  return { ...query, data };
}
