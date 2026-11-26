import { useEffect } from "react";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { subscribeTickStream } from "@/lib/api/stream-broker";
import { useStreamingTickStore } from "@/store/streaming-tick";

/** Subscribes once at app-shell scope and stores only the latest tick. */
export function useGlobalTickStream() {
  const apiIdentity = useApiCacheIdentity();
  const setTick = useStreamingTickStore((state) => state.setTick);

  useEffect(() => {
    setTick(null);
    return subscribeTickStream(apiIdentity, (next) => setTick(next.tick));
  }, [apiIdentity, setTick]);
}
