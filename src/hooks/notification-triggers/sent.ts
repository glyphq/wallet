import { useEffect, useRef } from "react";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { addressEnding, contractPhrase, notificationAmount } from "@/lib/notification-copy";
import type { PendingTx } from "@/store/persisted";

export interface SentNotificationTriggerInput {
  pendingTxs: PendingTx[];
  enabled: boolean;
  onSent: boolean;
}

/** Watches pendingTxs for newly broadcast transactions and notifies once per hash. */
export function useSentNotificationTriggers(input: SentNotificationTriggerInput) {
  const { pendingTxs, enabled, onSent } = input;
  const prevPendingHashesRef = useRef<Set<string>>(
    new Set(pendingTxs.map((t) => t.hash)),
  );

  useEffect(() => {
    const currentHashes = new Set(pendingTxs.map((t) => t.hash));
    if (enabled && onSent) {
      for (const tx of pendingTxs) {
        if (!prevPendingHashesRef.current.has(tx.hash)) {
          if (tx.contractName) {
            publishNotificationEvent(createNotificationEvent({
              kind: "sent",
              title: "Contract call submitted",
              body: `Your ${contractPhrase(tx.contractName)} call was submitted to the Qubic network.`,
              identity: tx.source,
              txHash: tx.hash,
              dedupeKey: `sent:${tx.hash}`,
            })).catch(() => {});
          } else {
            publishNotificationEvent(createNotificationEvent({
              kind: "sent",
              title: "Transfer sent",
              body: `A transfer of ${notificationAmount(tx.amount)} was sent to ${addressEnding(tx.destination)}.`,
              identity: tx.source,
              txHash: tx.hash,
              dedupeKey: `sent:${tx.hash}`,
            })).catch(() => {});
          }
        }
      }
    }
    prevPendingHashesRef.current = currentHashes;
  }, [pendingTxs, enabled, onSent]); // eslint-disable-line react-hooks/exhaustive-deps
}
