import type { WidgetConfig } from "tauri-plugin-widgets-api";

export const GLYPH_WIDGET_GROUP = "group.com.qubic.glyph";
export const GLYPH_OVERVIEW_WIDGET_ID = "wallet-overview";
export const GLYPH_OVERVIEW_WIDGET_LABEL = "glyph-wallet-overview";
export const MAX_WIDGET_CONFIG_CHARS = 128 * 1024;

/** A privacy-safe starting point. It contains no wallet-derived values. */
export function createDefaultWidgetConfig(): WidgetConfig {
  return {
    small: {
      type: "vstack",
      padding: 16,
      spacing: 8,
      cornerRadius: 18,
      background: { light: "#f6f7f9", dark: "#16181d" },
      children: [
        { type: "text", content: "GLYPH", fontSize: 12, fontWeight: "bold", color: { light: "#3f4652", dark: "#aeb7c7" } },
        { type: "text", content: "Wallet ready", textStyle: "title2", fontWeight: "bold", color: { light: "#101216", dark: "#f5f7fa" } },
        { type: "text", content: "Balance remains private", textStyle: "footnote", color: { light: "#687080", dark: "#aeb7c7" } },
      ],
    },
  };
}

export function stringifyWidgetConfig(config = createDefaultWidgetConfig()): string {
  return JSON.stringify(config, null, 2);
}

/** Validates the JSON boundary before it reaches the native widget transport. */
export function parseWidgetConfig(raw: string): WidgetConfig | null {
  if (!raw.trim() || raw.length > MAX_WIDGET_CONFIG_CHARS) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as WidgetConfig;
  } catch {
    return null;
  }
}
