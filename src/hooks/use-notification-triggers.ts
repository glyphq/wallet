import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useVaultBalances } from "@/hooks/use-vault-balances";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useTickInfo } from "@/hooks/use-tick-info";
import { notify } from "@/lib/notifications";
import { truncateId, formatQu } from "@/lib/format";
import { qk } from "@/lib/query-keys";

/** Fires desktop notifications on balance increases, tx broadcast, confirmation, and expiry. Also removes resolved pending txs. */
export function useNotificationTriggers() {
  const wallets = useSessionStore((s) => s.wallets);
  const addTxAlert = useSessionStore((s) => s.addTxAlert);
  const activeIndex = usePersistedStore((s) => s.settings.activeAccountIndex);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const removePendingTx = usePersistedStore((s) => s.removePendingTx);
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);

  const identity = wallets[activeIndex]?.identity ?? null;
  const queryClient = useQueryClient();

  // ── Received: watch all vault balances for increases ──────────────────
  const { data: allBalances } = useVaultBalances();
  const prevBalancesRef = useRef<Record<string, bigint>>({});

  useEffect(() => {
    if (!enabled || !onReceived || !allBalances) return;
    for (const [id, current] of Object.entries(allBalances)) {
      const prev = prevBalancesRef.current[id];
      if (prev !== undefined && current > prev) {
        const diff = current - prev;
        notify("QU Received", `+${diff.toLocaleString()} QU → ${truncateId(id, 8, 4)}`);
      }
    }
    prevBalancesRef.current = { ...allBalances };
  }, [allBalances]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sent: watch pendingTxs for additions ──────────────────────────────
  const prevPendingHashesRef = useRef<Set<string>>(
    new Set(pendingTxs.map((t) => t.hash)),
  );

  useEffect(() => {
    const currentHashes = new Set(pendingTxs.map((t) => t.hash));
    if (enabled && onSent) {
      for (const tx of pendingTxs) {
        if (!prevPendingHashesRef.current.has(tx.hash)) {
          if (tx.contractName) {
            notify(tx.contractName, "Transaction broadcast");
          } else {
            notify("QU Sent", `${BigInt(tx.amount).toLocaleString()} QU → ${truncateId(tx.destination, 8, 4)}`);
          }
        }
      }
    }
    prevPendingHashesRef.current = currentHashes;
  }, [pendingTxs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirmed / expired: driven by tick + tx history ─────────────────
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
    if (hasReady) queryClient.invalidateQueries({ queryKey: qk.txHistory(identity) });
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
        if (enabled && onConfirmed) notify("Confirmed", `${label} — confirmed on chain`);
      } else {
        addTxAlert({ id: pending.hash, label, reason: "failed" });
        if (enabled && onConfirmed) notify("Transaction Failed", `${label} — money did not fly`);
      }
    }
  }, [txHistory]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (enabled && onConfirmed) notify("Tick Missed", `${label} — target tick expired`);
      }
    }
  }, [currentTick, pendingTxs]); // eslint-disable-line react-hooks/exhaustive-deps
}
