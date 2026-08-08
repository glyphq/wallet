import { describe, expect, test } from "bun:test";
import {
  booleanWidgetField,
  defineWidget,
  enumWidgetField,
  integerWidgetField,
  sanitizeNativeWidgetConfiguration,
  toNativeWidgetPayload,
  type WidgetRegistry,
} from "./widgets";

const balanceWidget = defineWidget({
  type: "balance",
  fields: {
    showFiat: booleanWidgetField(true),
    density: enumWidgetField("comfortable", ["compact", "comfortable"] as const),
    refreshSeconds: integerWidgetField(30, 10, 300),
  },
});

const registry: WidgetRegistry = { balance: balanceWidget };

describe("native widget configuration boundary", () => {
  test("only passes declared, bounded preferences to native code", () => {
    const configuration = sanitizeNativeWidgetConfiguration(
      {
        version: 99,
        widgets: [
          {
            id: "balance-1",
            type: "balance",
            enabled: true,
            order: 3.9,
            preferences: {
              showFiat: "yes",
              density: "unknown",
              refreshSeconds: 999_999,
              identity: "QUSERIDENTITYSHOULDNOTCROSSIPC",
              balance: "123456789",
              nested: { transactionHistory: ["secret"] },
            },
          },
        ],
      },
      registry
    );

    expect(configuration).toEqual({
      version: 1,
      widgets: [
        {
          id: "balance-1",
          type: "balance",
          enabled: true,
          order: 3,
          preferences: {
            showFiat: true,
            density: "comfortable",
            refreshSeconds: 300,
          },
        },
      ],
    });
  });

  test("drops unknown widget types, malformed entries, and duplicate IDs", () => {
    const configuration = sanitizeNativeWidgetConfiguration(
      {
        widgets: [
          { id: "bad id", type: "balance", enabled: true, order: 0, preferences: {} },
          { id: "unknown", type: "history", enabled: true, order: 0, preferences: {} },
          { id: "balance-1", type: "balance", enabled: true, order: 0, preferences: {} },
          { id: "balance-1", type: "balance", enabled: false, order: 1, preferences: {} },
        ],
      },
      registry
    );

    expect(configuration.widgets).toHaveLength(1);
    expect(configuration.widgets[0]).toMatchObject({
      id: "balance-1",
      enabled: true,
      preferences: { showFiat: true, density: "comfortable", refreshSeconds: 30 },
    });
  });

  test("re-sanitizes an existing configuration before IPC", () => {
    const payload = toNativeWidgetPayload(
      {
        version: 1,
        widgets: [
          {
            id: "balance-1",
            type: "balance",
            enabled: true,
            order: 0,
            preferences: {
              showFiat: false,
              density: "compact",
              refreshSeconds: 20,
              address: "do-not-send",
            },
          },
        ],
      },
      registry
    );

    expect(payload.widgets[0]?.preferences).toEqual({
      showFiat: false,
      density: "compact",
      refreshSeconds: 20,
    });
  });
});
