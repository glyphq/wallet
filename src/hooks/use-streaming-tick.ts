import { useEffect, useState } from "react";
import { subscribeTickStream } from "@/lib/api/stream-broker";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

/** Keeps only the latest tick emitted by the shared tick stream. */
export function useStreamingTick(): number | null {
  const apiIdentity = useApiCacheIdentity();
  const [latest, setLatest] = useState<{ api: string; tick: number } | null>(null);

  useEffect(() => subscribeTickStream(apiIdentity, (next) => {
    setLatest((previous) =>
      previous?.api === apiIdentity && previous.tick === next.tick
        ? previous
        : { api: apiIdentity, tick: next.tick },
    );
  }), [apiIdentity]);

  return latest?.api === apiIdentity ? latest.tick : null;
}
