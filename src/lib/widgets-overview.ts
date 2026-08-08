import {
  booleanWidgetField,
  defineWidget,
  enumWidgetField,
  integerWidgetField,
} from "./widgets";

/**
 * Baseline wallet widget. Its settings describe presentation only. In
 * particular, it never stores or transports an account identity, address,
 * balance, price, transaction, or other wallet-derived value.
 */
export const walletOverviewWidget = defineWidget({
  type: "wallet-overview",
  fields: {
    /** Show an amount only after the user explicitly selects a less-private mode. */
    privacy: enumWidgetField("hidden", ["hidden", "redacted", "visible"] as const),
    showFiat: booleanWidgetField(false),
    /** A presentation refresh preference, not a balance polling instruction. */
    refreshSeconds: integerWidgetField(60, 30, 300),
  },
});

/** Registry to pass to widget editors and the eventual native IPC projection. */
export const walletWidgetRegistry = {
  [walletOverviewWidget.type]: walletOverviewWidget,
};
