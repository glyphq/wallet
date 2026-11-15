import { useEffect, useRef } from "react";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";

export interface PriceAlertTriggerInput {
  enabled: boolean;
  onPriceAlerts: boolean;
  priceAlertAboveValue: number;
  priceAlertBelowValue: number;
}

/** Fires price alert notifications when the QU price crosses a configured threshold. */
export function usePriceAlertTriggers(input: PriceAlertTriggerInput) {
  const { enabled, onPriceAlerts, priceAlertAboveValue, priceAlertBelowValue } = input;
  const { data: latestStats } = useLatestStats();
  const previousPriceRef = useRef<number | null>(null);
  const aboveTriggeredRef = useRef(false);
  const belowTriggeredRef = useRef(false);

  useEffect(() => {
    const price = latestStats?.price ?? null;
    if (!enabled || !onPriceAlerts || price === null || !Number.isFinite(price)) return;
    if (previousPriceRef.current === null) {
      previousPriceRef.current = price;
      aboveTriggeredRef.current = Number.isFinite(priceAlertAboveValue) && price >= priceAlertAboveValue;
      belowTriggeredRef.current = Number.isFinite(priceAlertBelowValue) && price <= priceAlertBelowValue;
      return;
    }

    if (Number.isFinite(priceAlertAboveValue)) {
      if (!aboveTriggeredRef.current && previousPriceRef.current < priceAlertAboveValue && price >= priceAlertAboveValue) {
        aboveTriggeredRef.current = true;
        publishNotificationEvent(createNotificationEvent({
          kind: "price_alert",
          title: "QU Price Alert",
          body: `QU moved above $${priceAlertAboveValue.toFixed(4)} and is now trading near $${price.toFixed(4)}.`,
          dedupeKey: `price:above:${priceAlertAboveValue}:${Math.floor(Date.now() / 60_000)}`,
        })).catch(() => {});
      }
      if (price < priceAlertAboveValue) aboveTriggeredRef.current = false;
    }

    if (Number.isFinite(priceAlertBelowValue)) {
      if (!belowTriggeredRef.current && previousPriceRef.current > priceAlertBelowValue && price <= priceAlertBelowValue) {
        belowTriggeredRef.current = true;
        publishNotificationEvent(createNotificationEvent({
          kind: "price_alert",
          title: "QU Price Alert",
          body: `QU moved below $${priceAlertBelowValue.toFixed(4)} and is now trading near $${price.toFixed(4)}.`,
          dedupeKey: `price:below:${priceAlertBelowValue}:${Math.floor(Date.now() / 60_000)}`,
        })).catch(() => {});
      }
      if (price > priceAlertBelowValue) belowTriggeredRef.current = false;
    }

    previousPriceRef.current = price;
  }, [enabled, latestStats?.price, onPriceAlerts, priceAlertAboveValue, priceAlertBelowValue]);
}
