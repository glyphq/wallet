import { useCallback, useEffect, useRef } from "react";
import { getTransactionLifecycle } from "@/lib/api/generated";
import { subscribeTransactionLifecycle } from "@/lib/api/lifecycle-stream";
import { subscribeIdentityStreams } from "@/lib/api/stream-broker";
import {
  resolutionFromLifecycle,
  resolutionFromLifecycleProgress,
  type TxResolution,
} from "@/lib/tx-resolution";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import type { PendingTx } from "@/store/persisted";

export interface PendingTransactionStreamInput {
  pendingTxs: PendingTx[];
  onResolution: (pending: PendingTx, resolution: TxResolution) => void;
}

/**
 * Resolves pending transactions from the Glyph SSE transaction feed instead of
 * polling history. Each distinct source identity gets one filtered stream.
 * Lifecycle is read on mount, reconnect, lag, and for a matched hash so a
 * dropped SSE frame cannot leave a pending transaction stuck.
 */
export function usePendingTransactionStream({ pendingTxs, onResolution }: PendingTransactionStreamInput) {
  const pendingRef = useRef(pendingTxs);
  pendingRef.current = pendingTxs;
  const onResolutionRef = useRef(onResolution);
  onResolutionRef.current = onResolution;
  const inFlightRef = useRef<Set<string>>(new Set());
  const apiIdentity = useApiCacheIdentity();

  const reconcile = useCallback(async (hashes?: string[]) => {
    const pendingByHash = new Map(pendingRef.current.map((tx) => [tx.hash, tx]));
    const targets = hashes ?? [...pendingByHash.keys()];

    await Promise.all(targets.map(async (hash) => {
      const pending = pendingByHash.get(hash);
      if (!pending || inFlightRef.current.has(hash)) return;
      inFlightRef.current.add(hash);
      try {
        const { data } = await getTransactionLifecycle({
          path: { hash },
          throwOnError: true,
        });
        const resolution = resolutionFromLifecycle(hash, data);
        if (resolution) onResolutionRef.current(pending, resolution);
      } catch {
        // Unknown, still pending, or temporarily unavailable: the stream or
        // the next reconnect will retry.
      } finally {
        inFlightRef.current.delete(hash);
      }
    }));
  }, []);

  // A new pending hash is checked immediately in case it was already indexed
  // between broadcast and the first stream connection.
  const pendingHashesKey = pendingTxs.map((tx) => tx.hash).sort().join("\n");
  useEffect(() => {
    if (pendingHashesKey) void reconcile();
  }, [pendingHashesKey, apiIdentity, reconcile]);

  // Each pending hash gets its own temporary lifecycle SSE link. The link
  // is renewed by the subscription after expiry or a closed connection.
  useEffect(() => {
    if (!pendingHashesKey) return;
    const unsubscribes = pendingHashesKey.split("\n").map((hash) =>
      subscribeTransactionLifecycle(hash, {
        onTerminal: (progress) => {
          const pending = pendingRef.current.find((tx) => tx.hash === hash);
          if (!pending) return;
          const resolution = resolutionFromLifecycleProgress(hash, progress);
          if (resolution) onResolutionRef.current(pending, resolution);
        },
      })
    );
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [pendingHashesKey, apiIdentity]);

  // Slow reconciliation fallback for clients without EventSource and for a
  // dropped lifecycle link that could not be renewed.
  useEffect(() => {
    if (!pendingHashesKey) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reconcile();
    }, 15_000);
    return () => clearInterval(timer);
  }, [pendingHashesKey, reconcile]);

  const sources = [...new Set(pendingTxs.map((tx) => tx.source))].sort();
  const sourcesKey = sources.join("\n");

  useEffect(() => {
    if (!sourcesKey) return;
    const unsubscribes = sourcesKey.split("\n").map((source) =>
      subscribeIdentityStreams(apiIdentity, source, {
        onOpen: () => void reconcile(),
        onLag: () => void reconcile(),
        onTransaction: (transaction) => {
          if (!pendingRef.current.some((tx) => tx.hash === transaction.hash)) return;
          void reconcile([transaction.hash]);
        },
      })
    );

    const reconcileOnOnline = () => void reconcile();
    const reconcileOnVisible = () => {
      if (document.visibilityState === "visible") void reconcile();
    };
    window.addEventListener("online", reconcileOnOnline);
    document.addEventListener("visibilitychange", reconcileOnVisible);

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      window.removeEventListener("online", reconcileOnOnline);
      document.removeEventListener("visibilitychange", reconcileOnVisible);
    };
  }, [sourcesKey, apiIdentity, reconcile]);
}
