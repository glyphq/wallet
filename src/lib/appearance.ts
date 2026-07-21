import type { FontPairId, AccentColorId } from "@/store/persisted";

export interface FontPair {
  id: FontPairId;
  name: string;
  sans: string;
  mono: string;
}

export interface AccentColor {
  id: AccentColorId;
  name: string;
  hex: string;
}

export const FONT_PAIRS: FontPair[] = [
  { id: "default",       name: "Geist",          sans: "'Geist', system-ui, sans-serif",            mono: "'Geist Mono', monospace" },
  { id: "inter",         name: "Inter",          sans: "'Inter', system-ui, sans-serif",            mono: "'JetBrains Mono', monospace" },
  { id: "ibm-plex",      name: "IBM Plex",       sans: "'IBM Plex Sans', system-ui, sans-serif",    mono: "'IBM Plex Mono', monospace" },
  { id: "space-grotesk", name: "Space Grotesk",  sans: "'Space Grotesk', system-ui, sans-serif",    mono: "'Space Mono', monospace" },
  { id: "fira",          name: "Fira",           sans: "'Fira Sans', system-ui, sans-serif",        mono: "'Fira Code', monospace" },
  { id: "jetbrains",     name: "JetBrains",      sans: "'Inter', system-ui, sans-serif",            mono: "'JetBrains Mono', monospace" },
];

export const ACCENT_COLORS: AccentColor[] = [
  { id: "green",  name: "Green",  hex: "#22c55e" },
  { id: "amber",  name: "Amber",  hex: "#f59e0b" },
  { id: "sky",    name: "Sky",    hex: "#0ea5e9" },
  { id: "violet", name: "Violet", hex: "#8b5cf6" },
  { id: "rose",   name: "Rose",   hex: "#f43f5e" },
  { id: "mono",   name: "Mono",   hex: "#909090" },
];

/** CSS variable names that the theme system overrides. */
export const THEME_VARS = [
  "--color-bg-canvas",
  "--color-bg-base",
  "--color-bg-surface",
  "--color-bg-surface-2",
  "--color-bg-elevated",
  "--color-bg-subtle",
  "--color-bg-inset",
  "--color-bg-overlay",
  "--color-bg-header",
  "--color-bg-nav",
  "--color-bg-input",
  "--color-bg-hover",
  "--color-bg-press",
  "--color-scrim",
  "--color-text-display",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-disabled",
  "--color-text-inverse",
  "--color-border-subtle",
  "--color-border-default",
  "--color-border-strong",
  "--color-border-contrast",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-muted",
  "--color-accent-contrast",
  "--color-focus-ring",
  "--color-focus-ring-soft",
  "--color-status-success",
  "--color-status-warning",
  "--color-status-error",
  "--color-status-info",
  "--color-status-success-soft",
  "--color-status-warning-soft",
  "--color-status-error-soft",
  "--color-status-info-soft",
  "--color-skeleton",
  "--color-chart-primary",
  "--color-chart-secondary",
  "--color-chart-grid",
  "--shadow-elevated",
  "--shadow-floating",
  "--shadow-overlay",
  "--shadow-surface",
];

/** Returns all CSS variable overrides for the given theme mode. */
export function getThemeVars(mode: "dark" | "light"): Record<string, string> {
  if (mode === "light") {
    return {
      "--color-bg-canvas":        "#ffffff",
      "--color-bg-base":          "#ffffff",
      "--color-bg-surface":       "#f5f5f7",
      "--color-bg-surface-2":     "#eaeaec",
      "--color-bg-elevated":      "#ffffff",
      "--color-bg-subtle":        "#f0f0f2",
      "--color-bg-inset":         "#ececee",
      "--color-bg-overlay":       "#f8f8fa",
      "--color-bg-header":        "rgba(255, 255, 255, 0.94)",
      "--color-bg-nav":           "rgba(255, 255, 255, 0.96)",
      "--color-bg-input":         "#f5f5f7",
      "--color-bg-hover":         "#eaeaec",
      "--color-bg-press":         "#dedee0",
      "--color-scrim":            "rgba(0, 0, 0, 0.36)",
      "--color-text-display":     "#0b0c0d",
      "--color-text-primary":     "#1a1c1e",
      "--color-text-secondary":   "#5c6370",
      "--color-text-tertiary":    "#868b94",
      "--color-text-disabled":    "#b0b4ba",
      "--color-text-inverse":     "#f4f6f7",
      "--color-border-subtle":    "rgba(0, 0, 0, 0.06)",
      "--color-border-default":   "rgba(0, 0, 0, 0.10)",
      "--color-border-strong":    "rgba(0, 0, 0, 0.16)",
      "--color-border-contrast":  "rgba(0, 0, 0, 0.22)",
      "--color-accent":           "#202020",
      "--color-accent-hover":     "#3a3a3a",
      "--color-accent-muted":     "rgba(32, 32, 32, 0.10)",
      "--color-accent-contrast":  "#f4f6f7",
      "--color-focus-ring":       "#202020",
      "--color-focus-ring-soft":  "rgba(32, 32, 32, 0.16)",
      "--color-status-success":   "#28a745",
      "--color-status-warning":   "#d4850a",
      "--color-status-error":     "#d1242f",
      "--color-status-info":      "#2563eb",
      "--color-status-success-soft": "rgba(40, 167, 69, 0.10)",
      "--color-status-warning-soft": "rgba(212, 133, 10, 0.10)",
      "--color-status-error-soft":   "rgba(209, 36, 47, 0.10)",
      "--color-status-info-soft":    "rgba(37, 99, 235, 0.10)",
      "--color-skeleton":         "rgba(0, 0, 0, 0.06)",
      "--color-chart-primary":    "#202020",
      "--color-chart-secondary":  "rgba(0, 0, 0, 0.28)",
      "--color-chart-grid":       "rgba(0, 0, 0, 0.07)",
      "--shadow-elevated":        "0 10px 24px rgba(0, 0, 0, 0.08)",
      "--shadow-floating":        "0 4px 16px rgba(0, 0, 0, 0.10)",
      "--shadow-overlay":         "0 8px 32px rgba(0, 0, 0, 0.12)",
      "--shadow-surface":         "0 2px 8px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.08)",
      "color-scheme":             "light",
    };
  }
  return {};
}

