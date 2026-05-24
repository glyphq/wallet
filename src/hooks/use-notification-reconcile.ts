import { useEffect, useMemo, useRef } from "react";
import { getLatestTick, getRpcClient } from "@/lib/rpc";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { formatQu, truncateId } from "@/lib/format";

const STARTUP_RECEIVED_LOOKBACK_MS = 0;
const PAGE_SIZE = 50;

async function fetchRecentTransactions(identity: string) {
  const result = await getRpcClient().archive.getTransactionsForIdentity({
    identity,
    pagination: { size: PAGE_SIZE, offset: 0 },
  });
  return result.ok ? (result.value.transactions ?? []) : [];
}

export function useNotificationReconcile() {
  const wallets = useSessionStore((s) => s.wallets);
  const cachedIdentities = useSessionStore((s) => s.cachedIdentities);
  const addTxAlert = useSessionStore((s) => s.addTxAlert);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const removePendingTx = usePersistedStore((s) => s.removePendingTx);
  const lastNotificationScanAt = usePersistedStore((s) => s.lastNotificationScanAt);
  const setLastNotificationScanAt = usePersistedStore((s) => s.setLastNotificationScanAt);

  const identities = useMemo(() => {
    const live = wallets.map((wallet) => wallet.identity);
    return live.length > 0 ? live : cachedIdentities;
  }, [wallets, cachedIdentities]);

  const identitiesKey = identities.join("|");
  const pendingKey = pendingTxs.map((tx) => tx.hash).sort().join("|");
  const runKeyRef = useRef<string>("");

  useEffect(() => {
    if (!usePersistedStore.persist.hasHydrated()) return;
    if (identities.length === 0) return;

    const runKey = `${identitiesKey}::${pendingKey}::${lastNotificationScanAt}`;
    if (runKeyRef.current === runKey) return;
    runKeyRef.current = runKey;

    let cancelled = false;

    async function reconcile() {
      const startedAt = Date.now();

      const historyByIdentity = new Map<string, Awaited<ReturnType<typeof fetchRecentTransactions>>>();
      const historyIdentities = [...new Set(pendingTxs.map((tx) => tx.source).filter(Boolean))];

      await Promise.all(
        historyIdentities.map(async (identity) => {
          historyByIdentity.set(identity, await fetchRecentTransactions(identity));
        }),
      );

      const latestTick = pendingTxs.length > 0 ? await getLatestTick().catch(() => 0) : 0;

      for (const pending of pendingTxs) {
        const history = historyByIdentity.get(pending.source) ?? [];
        const match = history.find((tx) => tx.hash === pending.hash);
        if (match?.hash) {
          removePendingTx(pending.hash);
          const label = pending.contractName ?? `${formatQu(pending.amount)} QU`;
          if (match.moneyFlew === false) {
            addTxAlert({ id: pending.hash, label, reason: "failed" });
            await publishNotificationEvent(createNotificationEvent({
              kind: "failed",
              title: "Transaction Failed",
              body: `${label} reached the chain, but the transfer did not complete successfully.`,
              identity: pending.source,
              txHash: pending.hash,
              dedupeKey: `resolved:${pending.hash}:failed`,
            }), { desktop: false });
          } else {
            await publishNotificationEvent(createNotificationEvent({
              kind: "confirmed",
              title: "Transaction Confirmed",
              body: `${label} was confirmed on chain.`,
              identity: pending.source,
              txHash: pending.hash,
              dedupeKey: `resolved:${pending.hash}:confirmed`,
            }), { desktop: false });
          }
          continue;
        }

        if (latestTick > 0 && latestTick > pending.targetTick + 30) {
          removePendingTx(pending.hash);
          const label = pending.contractName ?? `${formatQu(pending.amount)} QU`;
          addTxAlert({ id: pending.hash, label, reason: "expired" });
          await publishNotificationEvent(createNotificationEvent({
            kind: "expired",
            title: "Transaction Expired",
            body: `${label} missed its target tick and was removed from pending.`,
            identity: pending.source,
            txHash: pending.hash,
            dedupeKey: `resolved:${pending.hash}:expired`,
          }), { desktop: false });
        }
      }

      if (!cancelled && lastNotificationScanAt > 0) {
        await Promise.all(
          identities.map(async (identity) => {
            const result = await getRpcClient().archive.getTransactionsForIdentity({
              identity,
              filters: { destination: identity },
              ranges: { timestamp: { gte: String(Math.max(lastNotificationScanAt, startedAt - STARTUP_RECEIVED_LOOKBACK_MS)) } },
              pagination: { size: PAGE_SIZE, offset: 0 },
            });
            if (!result.ok) return;

            for (const tx of result.value.transactions ?? []) {
              if (!tx.hash || tx.moneyFlew === false) continue;
              await publishNotificationEvent(createNotificationEvent({
                kind: "received",
                title: "Incoming QU",
                body: `Received ${BigInt(tx.amount ?? "0").toLocaleString()} QU on ${truncateId(identity, 8, 4)} while Sigil was closed.`,
                identity,
                txHash: tx.hash,
                dedupeKey: `received:${tx.hash}:${identity}`,
                createdAt: tx.timestamp ? Number(tx.timestamp) : startedAt,
              }), { desktop: false });
            }
          }),
        );
      }

      if (!cancelled) setLastNotificationScanAt(startedAt);
    }

    reconcile().catch(() => {
      if (!cancelled) setLastNotificationScanAt(Date.now());
    });

    return () => {
      cancelled = true;
    };
  }, [identities, identitiesKey, pendingKey, pendingTxs, lastNotificationScanAt, removePendingTx, setLastNotificationScanAt, addTxAlert]);
}
