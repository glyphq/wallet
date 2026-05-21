import { useEffect, useRef } from "react";
import { getRpcClient } from "@/lib/rpc";
import { getBobRpcClient } from "@/lib/bob-client";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const POLL_MS = 10_000;

/**
 * When Bob node is enabled, periodically compares Bob's `lastIndexedTick`
 * (from epoch info — the tick Bob has actually finished indexing) against the
 * Qubic RPC live tick. Writes the lag to session store so the network overlay
 * can surface it. Always uses the Qubic RPC as the reference regardless of
 * which data source is active.
 */
export function useBobSync(): void {
  const useBobNode = usePersistedStore((s) => s.settings.network.useBobNode);
  const bobRestUrl = usePersistedStore((s) => s.settings.network.bobRestUrl);
  const setBobSyncLag = useSessionStore((s) => s.setBobSyncLag);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!useBobNode || !bobRestUrl) {
      setBobSyncLag(null);
      return;
    }

    async function check() {
      try {
        const bob = getBobRpcClient(bobRestUrl!);
        const [rpcResult, epochResult] = await Promise.all([
          getRpcClient().live.getTickInfo(),
          bob.getCurrentEpoch(),
        ]);
        if (!rpcResult.ok || !epochResult.ok) return;

        const epochInfoResult = await bob.getEpochInfo(epochResult.value);
        if (!epochInfoResult.ok) return;

        const rpcTick = rpcResult.value.tick ?? 0;
        const lag = rpcTick - epochInfoResult.value.lastIndexedTick;
        setBobSyncLag(lag);
      } catch {
        // non-critical
      }
    }

    check();
    intervalRef.current = setInterval(check, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setBobSyncLag(null);
    };
  }, [useBobNode, bobRestUrl, setBobSyncLag]);
}
