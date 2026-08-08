import type { WidgetConfig } from "tauri-plugin-widgets-api";

export const GLYPH_WIDGET_GROUP = "group.com.qubic.glyph";
export const GLYPH_OVERVIEW_WIDGET_ID = "wallet-overview";
export const GLYPH_OVERVIEW_WIDGET_LABEL = "glyph-wallet-overview";
export const MAX_WIDGET_CONFIG_CHARS = 128 * 1024;

export interface WidgetPreset {
  id: "private-status" | "focus" | "network";
  name: string;
  description: string;
  config: WidgetConfig;
}

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

const PRIVATE_STATUS = createDefaultWidgetConfig();

const FOCUS_WIDGET: WidgetConfig = {
  small: {
    type: "vstack",
    padding: 18,
    spacing: 10,
    cornerRadius: 20,
    background: { light: "#101216", dark: "#eef1f5" },
    children: [
      { type: "text", content: "GLYPH", fontSize: 12, fontWeight: "bold", color: { light: "#aeb7c7", dark: "#3f4652" } },
      { type: "text", content: "Private by default", textStyle: "title3", fontWeight: "bold", color: { light: "#ffffff", dark: "#101216" } },
      { type: "text", content: "Open Glyph to view your wallet", textStyle: "footnote", color: { light: "#d9dee7", dark: "#566070" } },
    ],
  },
};

const NETWORK_WIDGET: WidgetConfig = {
  small: {
    type: "vstack",
    padding: 16,
    spacing: 8,
    cornerRadius: 18,
    background: { light: "#f2f7f4", dark: "#112017" },
    children: [
      { type: "text", content: "GLYPH", fontSize: 12, fontWeight: "bold", color: { light: "#4c6b57", dark: "#a2d8b2" } },
      { type: "label", text: "Qubic wallet", systemName: "shield", fontSize: 18, fontWeight: "bold", color: { light: "#122218", dark: "#f0fff4" } },
      { type: "text", content: "Open Glyph for live network status", textStyle: "footnote", color: { light: "#4c6b57", dark: "#a2d8b2" } },
    ],
  },
};

export const STANDARD_WIDGET_PRESETS: readonly WidgetPreset[] = [
  { id: "private-status", name: "Private status", description: "A quiet, privacy-safe wallet status card.", config: PRIVATE_STATUS },
  { id: "focus", name: "Private focus", description: "A high-contrast reminder that balances stay in Glyph.", config: FOCUS_WIDGET },
  { id: "network", name: "Wallet shortcut", description: "A simple Qubic wallet card without account data.", config: NETWORK_WIDGET },
];

export function getWidgetPreset(id: WidgetPreset["id"]): WidgetPreset {
  return STANDARD_WIDGET_PRESETS.find((preset) => preset.id === id) ?? STANDARD_WIDGET_PRESETS[0];
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
