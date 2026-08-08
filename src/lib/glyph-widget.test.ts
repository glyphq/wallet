import { describe, expect, test } from "bun:test";
import { createDefaultWidgetConfig, MAX_WIDGET_CONFIG_CHARS, parseWidgetConfig, STANDARD_WIDGET_PRESETS, stringifyWidgetConfig } from "./glyph-widget";

describe("Glyph widget configuration", () => {
  test("uses a private default that round-trips through the parser", () => {
    const config = createDefaultWidgetConfig();
    expect(config.small?.type).toBe("vstack");
    expect(parseWidgetConfig(stringifyWidgetConfig(config))).toEqual(config);
  });

  test("rejects malformed and oversized editor input", () => {
    expect(parseWidgetConfig("[]")).toBeNull();
    expect(parseWidgetConfig("{")).toBeNull();
    expect(parseWidgetConfig(" ".repeat(MAX_WIDGET_CONFIG_CHARS + 1))).toBeNull();
  });

  test("ships three valid privacy-safe standard presets", () => {
    expect(STANDARD_WIDGET_PRESETS.map((preset) => preset.id)).toEqual(["private-status", "focus", "network"]);
    for (const preset of STANDARD_WIDGET_PRESETS) {
      expect(parseWidgetConfig(stringifyWidgetConfig(preset.config))).toEqual(preset.config);
    }
  });
});
