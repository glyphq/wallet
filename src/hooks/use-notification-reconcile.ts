import { useEffect, useMemo, useRef } from "react";
import { listIdentityTransactions } from "@/lib/api/generated";
import { normalizeApiTransaction } from "@/lib/tx-domain";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { truncateId } from "@/lib/format";

const STARTUP_RECEIVED_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 h
const PAGE_SIZE = 50;

export function useNotificationReconcile() {
  const accounts = useSessionStore((s) => s.accounts);
  const cachedIdentities = useSessionStore((s) => s.cachedIdentities);
  const setLastNotificationScanAt = usePersistedStore((s) => s.setLastNotificationScanAt);

  const identities = useMemo(() => {
    const live = accounts.map((account) => account.identity);
    return live.length > 0 ? live : cachedIdentities;
  }, [accounts, cachedIdentities]);

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
        const results = await Promise.all(
          identities.map(async (identity) => {
            const cutoff = Math.max(lastNotificationScanAt, startedAt - STARTUP_RECEIVED_LOOKBACK_MS);
            let cursor: string | undefined;
            for (let page = 0; page < 5; page++) {
              const { data } = await listIdentityTransactions({
                path: { identity },
                query: { limit: PAGE_SIZE, cursor },
                throwOnError: true,
              });

              for (const raw of data.data) {
                const tx = normalizeApiTransaction(raw);
                if (!tx?.hash || tx.destination !== identity || !tx.moneyFlew) continue;
                if (tx.timestamp !== null && tx.timestamp < cutoff) continue;
                await publishNotificationEvent(createNotificationEvent({
                  kind: "received",
                  title: "Funds received",
                  body: `${BigInt(tx.amount).toLocaleString()} QU on ${truncateId(identity, 8, 4)}`,
                  identity,
                  txHash: tx.hash,
                  dedupeKey: `received:${tx.hash}:${identity}`,
                  createdAt: tx.timestamp ?? startedAt,
                }), { desktop: false });
              }

              const oldest = data.data[data.data.length - 1]?.timestamp;
              const oldestMs = oldest ? Date.parse(oldest) : null;
              cursor = data.meta.next_cursor ?? undefined;
              if (!cursor || (oldestMs !== null && Number.isFinite(oldestMs) && oldestMs < cutoff)) break;
            }
            return true;
          }),
        );
        if (results.some((succeeded) => !succeeded)) return;
      }

      if (!cancelled) setLastNotificationScanAt(startedAt);
    }

    // Leave the watermark unchanged on an RPC or notification failure. The
    // event dedupe key makes a retry safe, whereas advancing it loses history.
    reconcile().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [identities, identitiesKey, setLastNotificationScanAt]);
}
