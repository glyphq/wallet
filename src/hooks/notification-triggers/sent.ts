import { useEffect, useRef } from "react";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { notificationAddress, contractPhrase, notificationAmount } from "@/lib/notification-copy";
import { etaSecondsFromTicks, networkTicksPerSecond } from "@/lib/pending-tx-progress";
import { useTickInfo } from "@/hooks/use-tick-info";
import type { PendingTx } from "@/store/persisted";

export interface SentNotificationTriggerInput {
  pendingTxs: PendingTx[];
  enabled: boolean;
  onSent: boolean;
}

/** Watches pendingTxs for newly broadcast transactions and notifies once per hash. */
export function useSentNotificationTriggers(input: SentNotificationTriggerInput) {
  const { pendingTxs, enabled, onSent } = input;
  const { data: tickInfo } = useTickInfo();
  const networkRate = networkTicksPerSecond(tickInfo?.ticksPerSecond, tickInfo?.duration);
  const prevPendingHashesRef = useRef<Set<string>>(
    new Set(pendingTxs.map((t) => t.hash)),
  );

  useEffect(() => {
    const currentHashes = new Set(pendingTxs.map((t) => t.hash));
    if (enabled && onSent) {
      for (const tx of pendingTxs) {
        if (!prevPendingHashesRef.current.has(tx.hash)) {
          const etaSeconds = tx.broadcastTick && tx.broadcastTick > 0
            ? etaSecondsFromTicks(tx.targetTick - tx.broadcastTick, networkRate) ?? undefined
            : undefined;
          if (tx.contractName) {
            publishNotificationEvent(createNotificationEvent({
              kind: "sent",
              title: "Contract call submitted",
              body: `Your ${contractPhrase(tx.contractName)} call was submitted to the network.`,
              identity: tx.source,
              txHash: tx.hash,
              dedupeKey: `sent:${tx.hash}`,
              etaSeconds,
            })).catch(() => {});
          } else {
            publishNotificationEvent(createNotificationEvent({
              kind: "sent",
              title: "Transfer sent",
              body: `A transfer of ${notificationAmount(tx.amount)} was sent to ${notificationAddress(tx.destination)}.`,
              identity: tx.source,
              txHash: tx.hash,
              dedupeKey: `sent:${tx.hash}`,
              etaSeconds,
            })).catch(() => {});
          }
        }
      }
    }
    prevPendingHashesRef.current = currentHashes;
  }, [pendingTxs, enabled, onSent, networkRate]);
}
