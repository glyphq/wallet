import { useCallback, useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useTickInfo } from "@/hooks/use-tick-info";
import { usePendingTransactionStream } from "@/hooks/use-pending-transaction-stream";
import type { LifecycleStreamProgress } from "@/lib/api/lifecycle-stream";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { notificationAddress, contractPhrase, notificationAmount } from "@/lib/notification-copy";
import { formatQu } from "@/lib/format";
import { etaSecondsFromTicks, networkTicksPerSecond } from "@/lib/pending-tx-progress";
import { emitTxResolution } from "@/lib/tx-resolution-events";
import type { TxResolution } from "@/lib/tx-resolution";
import type { PendingTx } from "@/store/persisted";
import type { TxAlert } from "@/store/session";

export interface TransactionResolutionTriggerInput {
  pendingTxs: PendingTx[];
  removePendingTx: (hash: string) => void;
  addTxAlert: (alert: TxAlert) => void;
  queryClient: QueryClient;
  enabled: boolean;
  onConfirmed: boolean;
  onMissedConfirmations: boolean;
}

/** Resolves pending txs from the SSE transaction feed; notifies on confirmation, failure, and expiry. */
export function useTransactionResolutionTriggers(input: TransactionResolutionTriggerInput) {
  const {
    pendingTxs,
    removePendingTx,
    addTxAlert,
    queryClient,
    enabled,
    onConfirmed,
    onMissedConfirmations,
  } = input;
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;
  const networkRate = networkTicksPerSecond(tickInfo?.ticksPerSecond, tickInfo?.duration);
  const resolvedHashesRef = useRef<Set<string>>(new Set());
  const progressReportedRef = useRef<Set<string>>(new Set());
  const etaReportedRef = useRef<Map<string, number | null>>(new Map());
  const tickSamplesRef = useRef<Map<string, { tick: number; at: number; rate: number }>>(new Map());

  // Drop remembered hashes once they leave the pending set, so a hash re-added
  // after a manual retry can resolve again.
  const pendingHashes = pendingTxs.map((tx) => tx.hash).join("\n");
  useEffect(() => {
    const live = new Set(pendingHashes ? pendingHashes.split("\n") : []);
    for (const hash of resolvedHashesRef.current) {
      if (!live.has(hash)) resolvedHashesRef.current.delete(hash);
    }
    for (const hash of progressReportedRef.current) {
      if (!live.has(hash)) progressReportedRef.current.delete(hash);
    }
    for (const hash of etaReportedRef.current.keys()) {
      if (!live.has(hash)) etaReportedRef.current.delete(hash);
    }
    for (const hash of tickSamplesRef.current.keys()) {
      if (!live.has(hash)) tickSamplesRef.current.delete(hash);
    }
  }, [pendingHashes]);

  const resolve = useCallback((pending: PendingTx, resolution: TxResolution) => {
    if (resolvedHashesRef.current.has(pending.hash)) return;
    resolvedHashesRef.current.add(pending.hash);
    void invoke("update_notification_progress", {
      hash: pending.hash,
      progress: 100,
      resolved: true,
      etaSeconds: null,
    }).catch(() => {});

    removePendingTx(pending.hash);
    emitTxResolution(resolution);
    void queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
    void queryClient.invalidateQueries({ queryKey: ["owned-assets"] });
    void queryClient.invalidateQueries({ queryKey: ["msvault"] });
    queryClient.invalidateQueries({ queryKey: ["tx-history"] });
    // The lifecycle tracker can confirm inclusion before the history index has
    // the row; refresh again so the confirmed transaction replaces the pending
    // row instead of briefly disappearing.
    window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["tx-history"] });
    }, 3_000);

    const label = pending.contractName ?? `${formatQu(pending.amount)} QU`;
    const transactionDescription = pending.contractName
      ? `Your ${contractPhrase(pending.contractName)} call`
      : `Your transfer of ${notificationAmount(pending.amount)} to ${notificationAddress(pending.destination)}`;
    if (resolution.status === "confirmed") {
      if (enabled && onConfirmed) {
        publishNotificationEvent(createNotificationEvent({
          kind: "confirmed",
          title: "Transaction confirmed",
          body: `${transactionDescription} was confirmed on the network.`,
          identity: pending.source,
          txHash: pending.hash,
          dedupeKey: `resolved:${pending.hash}:confirmed`,
        })).catch(() => {});
      }
      return;
    }

    if (resolution.status === "failed") {
      addTxAlert({ id: pending.hash, label, reason: "failed" });
      if (enabled && onMissedConfirmations) {
        publishNotificationEvent(createNotificationEvent({
          kind: "failed",
          title: "Transaction failed",
          body: `${transactionDescription} could not be confirmed on the network.`,
          identity: pending.source,
          txHash: pending.hash,
          dedupeKey: `resolved:${pending.hash}:failed`,
        })).catch(() => {});
      }
      return;
    }

    addTxAlert({ id: pending.hash, label, reason: "expired" });
    if (enabled && onMissedConfirmations) {
      publishNotificationEvent(createNotificationEvent({
        kind: "expired",
        title: "Transaction expired",
        body: `${transactionDescription} expired before it could be confirmed.`,
        identity: pending.source,
        txHash: pending.hash,
        dedupeKey: `resolved:${pending.hash}:expired`,
      })).catch(() => {});
    }
  }, [addTxAlert, enabled, onConfirmed, onMissedConfirmations, queryClient, removePendingTx]);

  const reportProgress = useCallback((pending: PendingTx, progress: LifecycleStreamProgress) => {
    if (["confirmed", "failed", "expired", "missed", "cancelled"].includes(progress.state)) return;
    const now = Date.now();
    const streamTick = progress.currentTick;
    let ticksPerSecond = networkRate;
    if (streamTick != null && streamTick > 0) {
      const previous = tickSamplesRef.current.get(pending.hash);
      if (previous && streamTick > previous.tick) {
        const elapsedSeconds = (now - previous.at) / 1000;
        if (elapsedSeconds > 0) {
          const measured = (streamTick - previous.tick) / elapsedSeconds;
          if (measured > 0 && measured < 100) {
            ticksPerSecond = previous.rate * 0.6 + measured * 0.4;
          }
        }
      }
      tickSamplesRef.current.set(pending.hash, { tick: streamTick, at: now, rate: ticksPerSecond });
    }
    const etaSeconds = streamTick != null && streamTick > 0
      ? etaSecondsFromTicks((progress.targetTick ?? pending.targetTick) - streamTick, ticksPerSecond)
      : null;
    const firstProgress = !progressReportedRef.current.has(pending.hash);
    if (!firstProgress && etaReportedRef.current.get(pending.hash) === etaSeconds) return;
    progressReportedRef.current.add(pending.hash);
    etaReportedRef.current.set(pending.hash, etaSeconds);
    const nextProgress = etaSeconds !== null && etaSeconds <= 0 ? 60 : 30;
    void invoke("update_notification_progress", {
      hash: pending.hash,
      progress: nextProgress,
      resolved: false,
      etaSeconds,
    }).catch(() => {
      progressReportedRef.current.delete(pending.hash);
      etaReportedRef.current.delete(pending.hash);
      tickSamplesRef.current.delete(pending.hash);
    });
  }, [networkRate]);

  usePendingTransactionStream({ pendingTxs, onResolution: resolve, onProgress: reportProgress });

  // Expiry needs the live tick, not transaction history. It still runs if SSE
  // is unavailable or the transaction never reaches the index.
  useEffect(() => {
    if (!currentTick) return;
    for (const pending of pendingTxs) {
      if (resolvedHashesRef.current.has(pending.hash)) continue;
      if (currentTick > pending.targetTick + 30) {
        resolve(pending, { hash: pending.hash, status: "expired", moneyFlew: null, includedTick: null });
      }
    }
  }, [currentTick, pendingTxs, resolve]);
}
