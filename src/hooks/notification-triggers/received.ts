import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useVaultBalances } from "@/hooks/use-vault-balances";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { truncateId } from "@/lib/format";
import type { PendingTx } from "@/store/persisted";

export interface ReceivedNotificationTriggerInput {
  pendingTxs: PendingTx[];
  enabled: boolean;
  onReceived: boolean;
  onLargeIncoming: boolean;
  largeIncomingThresholdValue: bigint | null;
  queryClient: QueryClient;
}

/** Watches all vault balances for increases and invalidates tx history for affected accounts. */
export function useReceivedNotificationTriggers(input: ReceivedNotificationTriggerInput) {
  const { pendingTxs, enabled, onReceived, onLargeIncoming, largeIncomingThresholdValue, queryClient } = input;
  const pendingTxsRef = useRef(pendingTxs);
  pendingTxsRef.current = pendingTxs;

  const { data: allBalances } = useVaultBalances();
  const prevBalancesRef = useRef<Record<string, bigint>>({});

  useEffect(() => {
    if (!allBalances) return;
    const changedIds = new Set<string>();
    for (const [id, current] of Object.entries(allBalances)) {
      const prev = prevBalancesRef.current[id];
      if (prev !== undefined) {
        if (current !== prev) changedIds.add(id);
        if (current > prev) {
          const diff = current - prev;
          if (enabled && onLargeIncoming && largeIncomingThresholdValue !== null && diff >= largeIncomingThresholdValue) {
            publishNotificationEvent(createNotificationEvent({
              kind: "received",
              title: "Large transfer received",
              body: `${diff.toLocaleString()} QU on ${truncateId(id, 8, 4)}`,
              identity: id,
            })).catch(() => {});
          } else if (enabled && onReceived) {
            publishNotificationEvent(createNotificationEvent({
              kind: "received",
              title: "Funds received",
              body: `${diff.toLocaleString()} QU on ${truncateId(id, 8, 4)}`,
              identity: id,
            })).catch(() => {});
          }
        }
      }
    }

    if (changedIds.size > 0 && pendingTxsRef.current.length > 0) {
      const affected = new Set<string>();
      for (const pending of pendingTxsRef.current) {
        if (changedIds.has(pending.source)) affected.add(pending.source);
        if (changedIds.has(pending.destination)) affected.add(pending.destination);
      }
      if (affected.size > 0) {
        queryClient.invalidateQueries({ queryKey: ["tx-history"] });
      }
    }

    prevBalancesRef.current = { ...allBalances };
  }, [allBalances, enabled, onReceived, onLargeIncoming, largeIncomingThresholdValue, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
}
