import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useTxHistory } from "@/hooks/use-tx-history";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { formatQu } from "@/lib/format";
import type { PendingTx } from "@/store/persisted";
import type { TxAlert } from "@/store/session";

export interface TransactionResolutionTriggerInput {
  identity: string | null;
  pendingTxs: PendingTx[];
  removePendingTx: (hash: string) => void;
  addTxAlert: (alert: TxAlert) => void;
  queryClient: QueryClient;
  enabled: boolean;
  onConfirmed: boolean;
  onMissedConfirmations: boolean;
}

/** Resolves pending txs via tick progress and tx history; notifies on confirmation, failure, and expiry. */
export function useTransactionResolutionTriggers(input: TransactionResolutionTriggerInput) {
  const {
    identity,
    pendingTxs,
    removePendingTx,
    addTxAlert,
    queryClient,
    enabled,
    onConfirmed,
    onMissedConfirmations,
  } = input;
  const { data: lastProcessedTickData } = useLastProcessedTick();
  const lastProcessedTick = lastProcessedTickData?.tickNumber ?? 0;
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;
  // Always fetch history when there are pending txs — cleanup must run regardless of notification prefs.
  const { data: txHistoryData } = useTxHistory(pendingTxs.length > 0 ? identity : null);
  const txHistory = txHistoryData?.pages.flat();
  const confirmedHashesRef = useRef<Set<string>>(new Set());
  const historyInitializedRef = useRef(false);

  // Reset history tracking when the active account changes so we don't fire
  // false "Confirmed" notifications for the new account's existing history.
  useEffect(() => {
    historyInitializedRef.current = false;
    confirmedHashesRef.current = new Set();
  }, [identity]);

  // Immediately refresh history when a pending tx's target tick is processed
  useEffect(() => {
    if (!lastProcessedTick || !identity) return;
    const hasReady = pendingTxs.some((p) => lastProcessedTick >= p.targetTick);
    if (hasReady) queryClient.invalidateQueries({ queryKey: ["tx-history"] });
  }, [lastProcessedTick, pendingTxs, identity, queryClient]);

  // Confirmed: tx appeared in history — always remove; notify if enabled.
  useEffect(() => {
    if (!txHistory) return;

    const historyHashSet = new Set(txHistory.map((t) => t.hash).filter(Boolean) as string[]);

    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      // On first load, silently remove pending txs already in history (no notification).
      for (const p of pendingTxs) {
        if (historyHashSet.has(p.hash)) {
          confirmedHashesRef.current.add(p.hash);
          removePendingTx(p.hash);
        }
      }
      return;
    }

    const historyMap = new Map<string, (typeof txHistory)[number]>();
    for (const t of txHistory) {
      if (t.hash) historyMap.set(t.hash, t);
    }

    for (const pending of pendingTxs) {
      if (confirmedHashesRef.current.has(pending.hash)) continue;
      const histTx = historyMap.get(pending.hash);
      if (!histTx) continue;
      confirmedHashesRef.current.add(pending.hash);
      removePendingTx(pending.hash);
      const label = pending.contractName ?? `${formatQu(pending.amount)} QU`;
      if (histTx.moneyFlew) {
        if (enabled && onConfirmed) {
          publishNotificationEvent(createNotificationEvent({
            kind: "confirmed",
            title: "Transaction confirmed",
            body: `${label} confirmed on chain`,
            identity: pending.source,
            txHash: pending.hash,
            dedupeKey: `resolved:${pending.hash}:confirmed`,
          })).catch(() => {});
        }
      } else {
        addTxAlert({ id: pending.hash, label, reason: "failed" });
        if (enabled && onMissedConfirmations) {
          publishNotificationEvent(createNotificationEvent({
            kind: "failed",
            title: "Transaction failed",
            body: `${label} could not be completed`,
            identity: pending.source,
            txHash: pending.hash,
            dedupeKey: `resolved:${pending.hash}:failed`,
          })).catch(() => {});
        }
      }
    }
  }, [txHistory, enabled, onConfirmed, onMissedConfirmations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expired: tx never appeared in history after target tick + 30 live ticks — always remove; notify if enabled.
  // Uses the live tick (same source as targetTick) so this fires reliably even if the archive lags.
  useEffect(() => {
    if (!currentTick) return;
    for (const pending of pendingTxs) {
      if (confirmedHashesRef.current.has(pending.hash)) continue;
      if (currentTick > pending.targetTick + 30) {
        confirmedHashesRef.current.add(pending.hash);
        removePendingTx(pending.hash);
        const label = pending.contractName ?? `${formatQu(pending.amount)} QU`;
        addTxAlert({ id: pending.hash, label, reason: "expired" });
        if (enabled && onMissedConfirmations) {
          publishNotificationEvent(createNotificationEvent({
            kind: "expired",
            title: "Transaction expired",
            body: `${label} timed out and was dropped`,
            identity: pending.source,
            txHash: pending.hash,
            dedupeKey: `resolved:${pending.hash}:expired`,
          })).catch(() => {});
        }
      }
    }
  }, [currentTick, pendingTxs, enabled, onMissedConfirmations]); // eslint-disable-line react-hooks/exhaustive-deps
}
