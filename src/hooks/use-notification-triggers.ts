import { useQueryClient } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useIdentityLiveUpdates } from "@/hooks/use-identity-live-updates";
import { useSentNotificationTriggers } from "@/hooks/notification-triggers/sent";
import { useTransactionResolutionTriggers } from "@/hooks/notification-triggers/confirmations";
import { usePriceAlertTriggers } from "@/hooks/notification-triggers/price-alerts";

/** Resolves transactions from streams and fires desktop notifications on transfers, broadcast, confirmation, and expiry. */
export function useNotificationTriggers() {
  const addTxAlert = useSessionStore((s) => s.addTxAlert);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const removePendingTx = usePersistedStore((s) => s.removePendingTx);
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);
  const onMissedConfirmations = usePersistedStore((s) => s.settings.notifyOnMissedConfirmations);
  const onPriceAlerts = usePersistedStore((s) => s.settings.notifyOnPriceAlerts);
  const priceAlertAbove = usePersistedStore((s) => s.settings.priceAlertAbove);
  const priceAlertBelow = usePersistedStore((s) => s.settings.priceAlertBelow);

  const queryClient = useQueryClient();
  const priceAlertAboveValue = priceAlertAbove ? Number(priceAlertAbove) : NaN;
  const priceAlertBelowValue = priceAlertBelow ? Number(priceAlertBelow) : NaN;

  useIdentityLiveUpdates();

  useSentNotificationTriggers({ pendingTxs, enabled, onSent });

  useTransactionResolutionTriggers({
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
