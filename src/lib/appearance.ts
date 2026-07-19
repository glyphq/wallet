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

// ── Color math ────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_COLOR_RE.test(hex)) return [0, 0, 0];
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns true if the hex color has low luminance (WCAG relative luminance < 0.4). */
export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.4;
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0)
          : max === g ? (b - r) / d + 2
          :             (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60  ? [c, x, 0] : h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] : h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :           [c, 0, x];
  return rgbToHex(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
}

function clampAccentLightness(hex: string, dark: boolean): string {
  const [h, s, l] = hexToHsl(hex);
  // On dark themes: only ensure accent isn't too dark (min 0.40), no upper cap
  // On light themes: ensure accent is dark enough to read (max 0.65)
  const [lo, hi] = dark ? [0.40, 1.0] : [0.25, 0.65];
  if (l >= lo && l <= hi) return hex;
  return hslToHex(h, s, Math.max(lo, Math.min(hi, l)));
}

export const CUSTOM_SCHEME_VARS = [
  "--color-bg-canvas",
  "--color-bg-base",
  "--color-bg-surface",
  "--color-bg-surface-2",
  "--color-bg-elevated",
  "--color-bg-subtle",
  "--color-bg-inset",
  "--color-bg-overlay",
  "--color-scrim",
  "--color-text-display",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-disabled",
  "--color-text-inverse",
  "--color-border-default",
  "--color-border-strong",
  "--color-border-subtle",
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
  "--color-skeleton",
  "--color-chart-primary",
  "--color-chart-secondary",
  "--color-chart-grid",
];

/** Derives the full CSS variable map for a custom color scheme from `bg` and `text` base colors. */
export function deriveCustomScheme(
  bg: string,
  text: string,
): Record<string, string> {
  const dark = isDarkColor(bg);
  const accentHex = "#ccfcfb";
  const accent = clampAccentLightness(accentHex, dark);
  return {
    "--color-bg-canvas":      bg,
    "--color-bg-base":        bg,
    "--color-bg-surface":     mix(bg, text, 0.06),
    "--color-bg-surface-2":   mix(bg, text, 0.10),
    "--color-bg-elevated":    mix(bg, text, 0.16),
    "--color-bg-subtle":      mix(bg, text, 0.12),
    "--color-bg-inset":       mix(bg, text, 0.04),
    "--color-bg-overlay":     mix(bg, text, 0.08),
    "--color-scrim":          dark ? "rgba(0, 0, 0, 0.68)" : "rgba(0, 0, 0, 0.36)",
    "--color-text-display":   text,
    "--color-text-primary":   mix(text, bg, 0.06),
    "--color-text-secondary": mix(text, bg, 0.34),
    "--color-text-tertiary":  mix(text, bg, 0.52),
    "--color-text-disabled":  mix(text, bg, 0.70),
    "--color-text-inverse":   dark ? "#0b0c0d" : "#f4f6f7",
    "--color-border-subtle":  mix(bg, text, 0.08),
    "--color-border-default": mix(bg, text, 0.12),
    "--color-border-strong":  mix(bg, text, 0.18),
    "--color-status-success": "#34c759",
    "--color-accent":         accent,
    "--color-accent-hover":   mix(accent, text, dark ? 0.16 : 0.06),
    "--color-accent-muted":   withAlpha(accent, 0.12),
    "--color-accent-contrast": dark ? "#081112" : "#f4f6f7",
    "--color-focus-ring":      accent,
    "--color-focus-ring-soft": withAlpha(accent, 0.24),
    "--color-status-warning": "#f59e0b",
    "--color-status-error":   dark ? "#d71921" : "#b91c1c",
    "--color-status-info":    dark ? "#8cb8ff" : "#3559c7",
    "--color-skeleton":       withAlpha(text, dark ? 0.08 : 0.10),
    "--color-chart-primary":  accent,
    "--color-chart-secondary": withAlpha(text, 0.28),
    "--color-chart-grid":      withAlpha(text, 0.08),
    "color-scheme":           dark ? "dark" : "light",
  };
}
