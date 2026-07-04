import { useEffect, useMemo, useRef } from "react";
import { getRpcClient } from "@/lib/rpc";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { truncateId } from "@/lib/format";

const STARTUP_RECEIVED_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 h
const PAGE_SIZE = 50;

export function useNotificationReconcile() {
  const wallets = useSessionStore((s) => s.wallets);
  const cachedIdentities = useSessionStore((s) => s.cachedIdentities);
  const setLastNotificationScanAt = usePersistedStore((s) => s.setLastNotificationScanAt);

  const identities = useMemo(() => {
    const live = wallets.map((wallet) => wallet.identity);
    return live.length > 0 ? live : cachedIdentities;
  }, [wallets, cachedIdentities]);

  const identitiesKey = identities.join("|");
  const runKeyRef = useRef<string>("");

  useEffect(() => {
    if (!usePersistedStore.persist.hasHydrated()) return;
    if (identities.length === 0) return;
    if (runKeyRef.current === identitiesKey) return;
    runKeyRef.current = identitiesKey;

    let cancelled = false;

    async function reconcile() {
      const startedAt = Date.now();
      const lastNotificationScanAt = usePersistedStore.getState().lastNotificationScanAt;

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
                title: "QU received",
                body: `${BigInt(tx.amount ?? "0").toLocaleString()} QU on ${truncateId(identity, 8, 4)}`,
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
  }, [identities, identitiesKey, setLastNotificationScanAt]);
}
