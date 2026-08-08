import { describe, expect, test } from "bun:test";
import {
  booleanWidgetField,
  defineWidget,
  enumWidgetField,
  type WidgetRegistry,
} from "@/lib/widgets";
import {
  createWidgetConfigurationState,
  reduceWidgetConfiguration,
} from "./widget-config-state";

const overviewWidget = defineWidget({
  type: "wallet-overview",
  fields: {
    showFiat: booleanWidgetField(true),
    privacy: enumWidgetField("redacted", ["hidden", "redacted", "visible"] as const),
  },
});

const registry: WidgetRegistry = { "wallet-overview": overviewWidget };

const initial = {
  version: 1,
  widgets: [
    {
      id: "overview-1",
      type: "wallet-overview",
      enabled: true,
      order: 0,
      preferences: { showFiat: true, privacy: "redacted" },
    },
  ],
};

describe("widget configuration editor state", () => {
  test("sanitizes preference edits instead of retaining arbitrary data", () => {
    const state = createWidgetConfigurationState(initial, registry);
    const next = reduceWidgetConfiguration(
      state,
      {
        type: "set-preferences",
        id: "overview-1",
        preferences: {
          showFiat: false,
          privacy: "visible",
          identity: "must-not-be-retained",
          balance: "must-not-be-retained",
        },
      },
      registry
    );

    expect(next.revision).toBe(1);
    expect(next.configuration.widgets[0]?.preferences).toEqual({
      showFiat: false,
      privacy: "visible",
    });
  });

  test("reorders requested widgets once and keeps unlisted widgets", () => {
    const state = createWidgetConfigurationState(
      {
        ...initial,
        widgets: [
          ...initial.widgets,
          {
            id: "overview-2",
            type: "wallet-overview",
            enabled: true,
            order: 1,
            preferences: {},
          },
        ],
      },
      registry
    );

    const next = reduceWidgetConfiguration(
      state,
      { type: "reorder", ids: ["overview-2", "overview-2"] },
      registry
    );

    expect(next.configuration.widgets.map((widget) => widget.id)).toEqual([
      "overview-2",
      "overview-1",
    ]);
    expect(next.configuration.widgets.map((widget) => widget.order)).toEqual([0, 1]);
  });
});
