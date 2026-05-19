import { useEffect, useRef } from "react";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { notify } from "@/lib/notifications";

function truncateId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function useNotificationTriggers() {
  const wallets = useSessionStore((s) => s.wallets);
  const activeIndex = usePersistedStore((s) => s.settings.activeAccountIndex);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);

  const identity = wallets[activeIndex]?.identity ?? null;

  // ── Received: watch balance for increases ─────────────────────────────
  const { data: balanceData } = useBalance(enabled && onReceived ? identity : null);
  const prevBalanceRef = useRef<bigint | null>(null);

  // Reset on account switch so we don't false-fire a "received" notification
  useEffect(() => {
    prevBalanceRef.current = null;
  }, [identity]);

  useEffect(() => {
    const current = balanceData?.balance ?? null;
    if (current !== null && prevBalanceRef.current !== null && current > prevBalanceRef.current) {
      const diff = current - prevBalanceRef.current;
      notify("QU Received", `+${Number(diff).toLocaleString()} QU${identity ? ` → ${truncateId(identity)}` : ""}`);
    }
    if (current !== null) prevBalanceRef.current = current;
  }, [balanceData?.balance]);  // eslint-disable-line react-hooks/exhaustive-deps

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
            notify(
              "QU Sent",
              `${Number(tx.amount).toLocaleString()} QU → ${truncateId(tx.destination)}`,
            );
          }
        }
      }
    }

    prevPendingHashesRef.current = currentHashes;
  }, [pendingTxs]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirmed: watch tx history for pending tx resolution ─────────────
  const { data: txHistory } = useTxHistory(enabled && onConfirmed ? identity : null);
  const { data: tickInfo } = useTickInfo();
  const confirmedHashesRef = useRef<Set<string>>(new Set());
  const historyInitializedRef = useRef(false);

  useEffect(() => {
    if (!txHistory) return;

    // On first history load, seed confirmed set so old txs don't re-notify
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      const historyHashSet = new Set(txHistory.map((t) => t.hash).filter(Boolean) as string[]);
      for (const p of pendingTxs) {
        if (historyHashSet.has(p.hash)) confirmedHashesRef.current.add(p.hash);
      }
      return;
    }

    if (!enabled || !onConfirmed) return;

    const historyMap = new Map<string, (typeof txHistory)[number]>();
    for (const t of txHistory) {
      if (t.hash) historyMap.set(t.hash, t);
    }

    for (const pending of pendingTxs) {
      if (confirmedHashesRef.current.has(pending.hash)) continue;
      const histTx = historyMap.get(pending.hash);
      if (!histTx) continue;

      confirmedHashesRef.current.add(pending.hash);
      const label = pending.contractName ?? `${Number(pending.amount).toLocaleString()} QU`;

      if (histTx.moneyFlew) {
        notify("Confirmed", `${label} — confirmed on chain`);
      } else {
        notify("Transaction Failed", `${label} — money did not fly`);
      }
    }
  }, [txHistory]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Expired pending txs (never appeared in history, tick passed)
  useEffect(() => {
    if (!enabled || !onConfirmed) return;
    if (!tickInfo?.tick) return;

    for (const pending of pendingTxs) {
      if (confirmedHashesRef.current.has(pending.hash)) continue;
      if (tickInfo.tick > pending.targetTick + 30) {
        confirmedHashesRef.current.add(pending.hash);
        const label = pending.contractName ?? `${Number(pending.amount).toLocaleString()} QU`;
        notify("Tick Missed", `${label} — target tick expired`);
      }
    }
  }, [tickInfo?.tick, pendingTxs]);  // eslint-disable-line react-hooks/exhaustive-deps
}
