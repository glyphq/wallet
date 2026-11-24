import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { subscribeIdentityStreams, type IdentityStreamListener } from "@/lib/api/stream-broker";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { parseEventBody } from "@/lib/tx-domain";
import { truncateId } from "@/lib/format";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const REFRESH_THROTTLE_MS = 1_500;

function invalidateIdentityData(queryClient: QueryClient, apiIdentity: string, identities: Set<string>) {
  void queryClient.invalidateQueries({ queryKey: ["vault-balances"] });
  void queryClient.invalidateQueries({ queryKey: ["vault-analytics"] });
  for (const identity of identities) {
    void queryClient.invalidateQueries({ queryKey: ["owned-assets", apiIdentity, identity] });
    void queryClient.invalidateQueries({ queryKey: ["tx-history", apiIdentity, identity] });
  }
}

interface TransferBody {
  from: string | null;
  to: string | null;
  amount: bigint | null;
}

function transferBody(body: unknown): TransferBody | null {
  const parsed = parseEventBody(body);
  if (!parsed) return null;
  const from = typeof parsed.from === "string" ? parsed.from : null;
  const to = typeof parsed.to === "string" ? parsed.to : null;
  const amount = typeof parsed.amount === "number" || typeof parsed.amount === "string"
    ? (() => { try { return BigInt(parsed.amount as string | number); } catch { return null; } })()
    : null;
  return { from, to, amount };
}

/**
 * Opens the shared identity feeds and turns them into cache invalidations and
 * received-transfer notifications. No periodic balance/history polling.
 */
export function useIdentityLiveUpdates() {
  const wallets = useSessionStore((s) => s.wallets);
  const cachedIdentities = useSessionStore((s) => s.cachedIdentities);
  const isLocked = useSessionStore((s) => s.isLocked);
  const apiIdentity = useApiCacheIdentity();
  const queryClient = useQueryClient();

  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onLargeIncoming = usePersistedStore((s) => s.settings.notifyOnLargeIncoming);
  const largeIncomingThreshold = usePersistedStore((s) => s.settings.largeIncomingThreshold);
  const threshold = (() => {
    try {
      return largeIncomingThreshold ? BigInt(largeIncomingThreshold) : null;
    } catch {
      return null;
    }
  })();

  const identities = isLocked
    ? (notifyWhenLocked ? cachedIdentities : [])
    : wallets.map((wallet) => wallet.identity);
  const identitiesKey = identities.join("|");

  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!identitiesKey) return;

    const scheduleRefresh = (identity: string) => {
      pendingRef.current.add(identity);
      if (timerRef.current !== null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = new Set(pendingRef.current);
        pendingRef.current.clear();
        invalidateIdentityData(queryClient, apiIdentity, pending);
      }, REFRESH_THROTTLE_MS);
    };

    const listeners = identitiesKey.split("|").map((identity) => {
      const listener: IdentityStreamListener = {
        onTransaction: () => scheduleRefresh(identity),
        onEvent: (event) => {
          scheduleRefresh(identity);
          if (!enabled || !onReceived || event.type_name !== "qu_transfer") return;
          const transfer = transferBody(event.body);
          if (!transfer || transfer.to !== identity || transfer.from === identity) return;
          if (transfer.amount === null || transfer.amount <= 0n) return;
          const large = onLargeIncoming && threshold !== null && transfer.amount >= threshold;
          const hash = event.tx_hash || `${identity}:${event.tick ?? 0}:${event.log_id ?? 0}`;
          const parsedTimestamp = event.timestamp ? Date.parse(event.timestamp) : Number.NaN;
          publishNotificationEvent(createNotificationEvent({
            kind: "received",
            title: large ? "Large transfer received" : "Funds received",
            body: `${transfer.amount.toLocaleString()} QU on ${truncateId(identity, 8, 4)}`,
            identity,
            txHash: event.tx_hash || undefined,
            dedupeKey: `received:${hash}:${identity}`,
            createdAt: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
          })).catch(() => {});
        },
        onLag: () => scheduleRefresh(identity),
        onOpen: () => scheduleRefresh(identity),
      };
      return subscribeIdentityStreams(apiIdentity, identity, listener);
    });

    return () => {
      for (const unsubscribe of listeners) unsubscribe();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current.clear();
    };
  }, [identitiesKey, apiIdentity, enabled, onReceived, onLargeIncoming, threshold, queryClient]);
}
