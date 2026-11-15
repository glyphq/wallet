import { useQueryClient } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useReceivedNotificationTriggers } from "@/hooks/notification-triggers/received";
import { useSentNotificationTriggers } from "@/hooks/notification-triggers/sent";
import { useTransactionResolutionTriggers } from "@/hooks/notification-triggers/confirmations";
import { usePriceAlertTriggers } from "@/hooks/notification-triggers/price-alerts";

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
  const onMissedConfirmations = usePersistedStore((s) => s.settings.notifyOnMissedConfirmations);
  const onLargeIncoming = usePersistedStore((s) => s.settings.notifyOnLargeIncoming);
  const largeIncomingThreshold = usePersistedStore((s) => s.settings.largeIncomingThreshold);
  const onPriceAlerts = usePersistedStore((s) => s.settings.notifyOnPriceAlerts);
  const priceAlertAbove = usePersistedStore((s) => s.settings.priceAlertAbove);
  const priceAlertBelow = usePersistedStore((s) => s.settings.priceAlertBelow);

  const identity = wallets[activeIndex]?.identity ?? null;
  const queryClient = useQueryClient();
  const largeIncomingThresholdValue = (() => {
    try {
      return largeIncomingThreshold ? BigInt(largeIncomingThreshold) : null;
    } catch {
      return null;
    }
  })();
  const priceAlertAboveValue = priceAlertAbove ? Number(priceAlertAbove) : NaN;
  const priceAlertBelowValue = priceAlertBelow ? Number(priceAlertBelow) : NaN;

  useReceivedNotificationTriggers({
    pendingTxs,
    enabled,
    onReceived,
    onLargeIncoming,
    largeIncomingThresholdValue,
    queryClient,
  });

  useSentNotificationTriggers({ pendingTxs, enabled, onSent });

  useTransactionResolutionTriggers({
    identity,
    pendingTxs,
    removePendingTx,
    addTxAlert,
    queryClient,
    enabled,
    onConfirmed,
    onMissedConfirmations,
  });

  usePriceAlertTriggers({
    enabled,
    onPriceAlerts,
    priceAlertAboveValue,
    priceAlertBelowValue,
  });
}
