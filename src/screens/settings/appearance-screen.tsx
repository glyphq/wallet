import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { stepMotion, transition, gesture, staggerContainer, staggerItem } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore, type FontPairId, type AccentColorId } from "@/store/persisted";
import { FONT_PAIRS, ACCENT_COLORS, type FontPair, type AccentColor } from "@/lib/appearance";

// ── Live preview card ────────────────────────────────────────────────────────

function LivePreview({ font, accent }: { font: FontPair; accent: AccentColor }) {
  return (
    <motion.div
      layout
      transition={transition.spring}
      style={{
        background: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border-subtle)",
        padding: "var(--space-4)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Gradient glow behind the card using accent */}
      <div style={{
        position: "absolute",
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${accent.hex}22 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Mock header bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: `linear-gradient(135deg, ${accent.hex}40, ${accent.hex}15)`,
            border: `1px solid ${accent.hex}30`,
          }} />
          <div>
            <div style={{
              fontFamily: font.sans,
              fontSize: "var(--text-label)",
              fontWeight: 500,
              color: "var(--color-text-display)",
              lineHeight: 1.2,
            }}>
              Main vault
            </div>
            <div style={{
              fontFamily: font.mono,
              fontSize: "10px",
              color: "var(--color-text-disabled)",
              letterSpacing: "0.04em",
            }}>
              ABCD...WXYZ
            </div>
          </div>
        </div>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: accent.hex,
          boxShadow: `0 0 8px ${accent.hex}60`,
        }} />
      </div>

      {/* Balance */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{
          fontFamily: font.sans,
          fontSize: "var(--text-caption)",
          color: "var(--color-text-disabled)",
          marginBottom: "var(--space-1)",
        }}>
          Balance
        </div>
        <div style={{
          fontFamily: font.mono,
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "var(--color-text-display)",
          letterSpacing: "-0.01em",
        }}>
          1,234,567.89 <span style={{ fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>QU</span>
        </div>
      </div>

      {/* Mock action buttons */}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <div style={{
          flex: 1,
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-sharp)",
          background: accent.hex,
          fontFamily: font.sans,
          fontSize: "var(--text-label)",
          fontWeight: 500,
          color: "#000",
          textAlign: "center",
        }}>
          Send
        </div>
        <div style={{
          flex: 1,
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-sharp)",
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-strong)",
          fontFamily: font.sans,
          fontSize: "var(--text-label)",
          fontWeight: 500,
          color: "var(--color-text-secondary)",
          textAlign: "center",
        }}>
          Receive
        </div>
      </div>

      {/* Mock activity row */}
      <div style={{
        marginTop: "var(--space-3)",
        padding: "var(--space-2) 0",
        borderTop: "1px solid var(--color-border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4,
            background: "var(--color-bg-surface)",
          }} />
          <div>
            <div style={{
              fontFamily: font.sans,
              fontSize: "11px",
              color: "var(--color-text-primary)",
            }}>
              Sent to Alice
            </div>
            <div style={{
              fontFamily: font.mono,
              fontSize: "10px",
              color: "var(--color-text-disabled)",
            }}>
              2 min ago
            </div>
          </div>
        </div>
        <div style={{
          fontFamily: font.mono,
          fontSize: "11px",
          color: accent.hex,
          fontWeight: 500,
        }}>
          −500 QU
        </div>
      </div>
    </motion.div>
  );
}

// ── Font card ────────────────────────────────────────────────────────────────

function FontCard({ pair, selected, onSelect }: { pair: FontPair; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      onClick={onSelect}
      style={{
        background: selected ? "var(--color-bg-surface)" : "transparent",
        border: `1px solid ${selected ? "var(--color-border-strong)" : "var(--color-border-subtle)"}`,
        borderRadius: "var(--radius-card)",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {/* Selection indicator — left accent bar */}
      <motion.div
        animate={{ scaleY: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
        transition={transition.spring}
        style={{
          position: "absolute",
          left: 0,
          top: "var(--space-3)",
          bottom: "var(--space-3)",
          width: 3,
          borderRadius: 2,
          background: "var(--color-accent)",
          transformOrigin: "center",
        }}
      />

      {/* Font name */}
      <div style={{
        fontFamily: pair.sans,
        fontSize: "var(--text-body)",
        fontWeight: 600,
        color: "var(--color-text-display)",
        lineHeight: 1.2,
      }}>
        {pair.name}
      </div>

      {/* Sans preview */}
      <div style={{
        fontFamily: pair.sans,
        fontSize: "var(--text-label)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.4,
      }}>
        The quick brown fox jumps over the lazy dog
      </div>

      {/* Mono preview */}
      <div style={{
        fontFamily: pair.mono,
        fontSize: "var(--text-mono-sm)",
        color: "var(--color-text-disabled)",
        letterSpacing: "0.05em",
      }}>
        0xA1B2...F9E8 · 1,234,567 QU
      </div>
    </motion.button>
  );
}

// ── Accent swatch ────────────────────────────────────────────────────────────

function AccentSwatch({ color, selected, onSelect }: { color: AccentColor; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      {...gesture.press}
      onClick={onSelect}
      title={color.name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "var(--space-1)",
      }}
    >
      <div style={{ position: "relative" }}>
        {/* Glow ring for selected */}
        <motion.div
          animate={{
            scale: selected ? 1 : 0,
            opacity: selected ? 1 : 0,
          }}
          transition={transition.spring}
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `2px solid ${color.hex}`,
            boxShadow: `0 0 12px ${color.hex}30`,
          }}
        />
        <motion.div
          animate={{ scale: selected ? 1.08 : 1 }}
          transition={transition.spring}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: color.hex,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Inner checkmark */}
          <AnimatePresence>
            {selected && (
              <motion.svg
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={transition.springStiff}
                viewBox="0 0 24 24"
                fill="none"
                stroke={isLightColor(color.hex) ? "#000" : "#fff"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  inset: 7,
                }}
              >
                <path d="M5 12l5 5L20 7" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <span style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        color: selected ? "var(--color-text-display)" : "var(--color-text-disabled)",
        fontWeight: selected ? 500 : 400,
      }}>
        {color.name}
      </span>
    </motion.button>
  );
}

function isLightColor(hex: string): boolean {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// ── Theme presets ────────────────────────────────────────────────────────────

interface ThemePreset {
  id: string;
  name: string;
  bg: string;
  text: string;
  preview: string; // gradient for the preview swatch
}

const THEME_PRESETS: ThemePreset[] = [
  { id: "midnight", name: "Midnight",  bg: "#0F0F0F", text: "#ffffff", preview: "linear-gradient(135deg, #0F0F0F, #1a1a1e)" },
  { id: "obsidian", name: "Obsidian",  bg: "#111111", text: "#f5f5f5", preview: "linear-gradient(135deg, #111111, #1c1c1e)" },
  { id: "charcoal", name: "Charcoal",  bg: "#1a1a1e", text: "#e8e8e8", preview: "linear-gradient(135deg, #1a1a1e, #2a2a2e)" },
  { id: "slate",    name: "Slate",     bg: "#1e293b", text: "#f1f5f9", preview: "linear-gradient(135deg, #1e293b, #334155)" },
  { id: "pure",     name: "Pure black",bg: "#000000", text: "#ffffff", preview: "linear-gradient(135deg, #000000, #111111)" },
];

function ThemeSwatch({ preset, selected, onSelect }: { preset: ThemePreset; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <motion.div
        animate={{
          borderColor: selected ? "var(--color-accent)" : "var(--color-border-subtle)",
          boxShadow: selected ? "0 0 0 1px var(--color-accent)" : "0 0 0 0px transparent",
        }}
        transition={transition.spring}
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-sharp)",
          background: preset.preview,
          border: "1px solid var(--color-border-subtle)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Mini mockup lines */}
        <div style={{
          position: "absolute",
          bottom: 6,
          left: 6,
          right: 6,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}>
          <div style={{ height: 3, width: "60%", borderRadius: 1, background: `${preset.text}40` }} />
          <div style={{ height: 2, width: "80%", borderRadius: 1, background: `${preset.text}20` }} />
          <div style={{ height: 2, width: "40%", borderRadius: 1, background: `${preset.text}15` }} />
        </div>
      </motion.div>
      <span style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        color: selected ? "var(--color-text-display)" : "var(--color-text-disabled)",
        fontWeight: selected ? 500 : 400,
      }}>
        {preset.name}
      </span>
    </motion.button>
  );
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-label)",
      fontWeight: 500,
      color: "var(--color-text-disabled)",
      letterSpacing: "0.08em",
      textTransform: "none",
    }}>
      {children}
    </span>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function AppearanceScreen() {
  const fontPairId = usePersistedStore((s) => s.settings.fontPair);
  const accentColorId = usePersistedStore((s) => s.settings.accentColor);
  const customScheme = usePersistedStore((s) => s.settings.customScheme);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const selectedFont = FONT_PAIRS.find((p) => p.id === fontPairId) ?? FONT_PAIRS[0];
  const selectedAccent = ACCENT_COLORS.find((a) => a.id === accentColorId) ?? ACCENT_COLORS[0];

  const [previewKey, setPreviewKey] = useState(0);

  const handleFontChange = useCallback((id: FontPairId) => {
    updateSettings({ fontPair: id });
    setPreviewKey((k) => k + 1);
  }, [updateSettings]);

  const handleAccentChange = useCallback((id: AccentColorId) => {
    updateSettings({ accentColor: id });
    setPreviewKey((k) => k + 1);
  }, [updateSettings]);

  const handleThemeChange = useCallback((preset: ThemePreset) => {
    if (preset.id === "midnight") {
      // Default theme — clear custom scheme
      updateSettings({ customScheme: null });
    } else {
      updateSettings({ customScheme: { bg: preset.bg, text: preset.text } });
    }
    setPreviewKey((k) => k + 1);
  }, [updateSettings]);

  // Determine which theme preset is active
  const activeThemeId = customScheme
    ? (THEME_PRESETS.find((p) => p.bg === customScheme.bg)?.id ?? "custom")
    : "midnight";

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column" }}>
      <motion.div
        {...stepMotion}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
      >
        <SettingsPageHeader title="Appearance" />

        {/* ── Live preview ── */}
        <motion.div
          key={previewKey}
          initial={{ scale: 0.98, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
        >
          <LivePreview font={selectedFont} accent={selectedAccent} />
        </motion.div>

        {/* ── Font pair ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <motion.div variants={staggerItem}>
            <SectionLabel>Typography</SectionLabel>
          </motion.div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {FONT_PAIRS.map((pair) => (
              <motion.div key={pair.id} variants={staggerItem}>
                <FontCard
                  pair={pair}
                  selected={fontPairId === pair.id}
                  onSelect={() => handleFontChange(pair.id as FontPairId)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Accent color ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <motion.div variants={staggerItem}>
            <SectionLabel>Accent</SectionLabel>
          </motion.div>
          <motion.div
            variants={staggerItem}
            style={{
              display: "flex",
              justifyContent: "space-around",
              padding: "var(--space-2) 0",
            }}
          >
            {ACCENT_COLORS.map((color) => (
              <AccentSwatch
                key={color.id}
                color={color}
                selected={accentColorId === color.id}
                onSelect={() => handleAccentChange(color.id as AccentColorId)}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* ── Theme ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <motion.div variants={staggerItem}>
            <SectionLabel>Theme</SectionLabel>
          </motion.div>
          <motion.div
            variants={staggerItem}
            style={{
              display: "flex",
              justifyContent: "space-around",
              padding: "var(--space-2) 0",
            }}
          >
            {THEME_PRESETS.map((preset) => (
              <ThemeSwatch
                key={preset.id}
                preset={preset}
                selected={activeThemeId === preset.id}
                onSelect={() => handleThemeChange(preset)}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom padding for scroll */}
        <div style={{ height: "var(--space-16)" }} />
      </motion.div>
    </AppShell>
  );
}
