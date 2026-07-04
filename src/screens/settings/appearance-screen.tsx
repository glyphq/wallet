import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion, staggerContainer, staggerItem } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore, type FontPairId } from "@/store/persisted";
import { FONT_PAIRS } from "@/lib/appearance";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-disabled)",
  letterSpacing: "0.08em",
};

// ── Font ─────────────────────────────────────────────────────────────────────

function FontCard({ pair, selected, onSelect }: { pair: typeof FONT_PAIRS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? "var(--color-text-display)" : "var(--color-bg-surface)",
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-3)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        border: "none",
      }}
    >
      <div style={{ fontFamily: pair.sans, fontSize: "var(--text-body)", fontWeight: 500, color: selected ? "var(--color-bg-base)" : "var(--color-text-primary)", lineHeight: 1.2 }}>
        {pair.name}
      </div>
      <div style={{ fontFamily: pair.mono, fontSize: "var(--text-mono-sm)", color: selected ? "var(--color-bg-base)" : "var(--color-text-disabled)", marginTop: "var(--space-1)", letterSpacing: "0.04em" }}>
        0xA1B2...F9E8
      </div>
    </button>
  );
}

// ── Themes ───────────────────────────────────────────────────────────────────

interface ThemeOption {
  id: string;
  name: string;
  bg: string;
  text: string;
  borderPreview: string;
}

const THEMES: ThemeOption[] = [
  { id: "dark",      name: "Dark",      bg: "#0F0F0F", text: "#ffffff", borderPreview: "#2c2c2e" },
  { id: "white",     name: "White",     bg: "#ffffff", text: "#111111", borderPreview: "#e5e5e5" },
  { id: "charcoal",  name: "Charcoal",  bg: "#1a1a1e", text: "#e8e8e8", borderPreview: "#2a2a2e" },
];

function ThemeCard({ theme, selected, onSelect }: { theme: ThemeOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? "var(--color-text-display)" : "var(--color-bg-surface)",
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-3)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        border: "none",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "var(--radius-sharp)",
        background: theme.bg,
        border: `1px solid ${theme.borderPreview}`,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        color: selected ? "var(--color-bg-base)" : "var(--color-text-primary)",
      }}>
        {theme.name}
      </span>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sharp)",
  padding: "var(--space-2) var(--space-3)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-primary)",
  width: "100%",
  outline: "none",
};

// ── Screen ───────────────────────────────────────────────────────────────────

export default function AppearanceScreen() {
  const fontPair = usePersistedStore((s) => s.settings.fontPair);
  const customScheme = usePersistedStore((s) => s.settings.customScheme);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const [customBg, setCustomBg] = useState(customScheme?.bg ?? "#0F0F0F");
  const [customText, setCustomText] = useState(customScheme?.text ?? "#ffffff");

  const activeTheme = customScheme
    ? (THEMES.find((t) => t.bg === customScheme.bg)?.id ?? "custom")
    : "dark";

  function selectTheme(theme: ThemeOption) {
    if (theme.id === "dark") {
      updateSettings({ customScheme: null });
    } else {
      updateSettings({ customScheme: { bg: theme.bg, text: theme.text } });
    }
  }

  function applyCustom() {
    updateSettings({ customScheme: { bg: customBg, text: customText } });
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column" }}>
      <motion.div
        {...stepMotion}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
      >
        <SettingsPageHeader title="Appearance" />

        {/* ── Font ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <motion.span variants={staggerItem} style={labelStyle}>Font</motion.span>
          <motion.div variants={staggerItem} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
            {FONT_PAIRS.map((pair) => (
              <FontCard
                key={pair.id}
                pair={pair}
                selected={fontPair === pair.id}
                onSelect={() => updateSettings({ fontPair: pair.id as FontPairId })}
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
          <motion.span variants={staggerItem} style={labelStyle}>Theme</motion.span>
          <motion.div variants={staggerItem} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
            {THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={activeTheme === theme.id}
                onSelect={() => selectTheme(theme)}
              />
            ))}
          </motion.div>

          {/* Custom theme */}
          <motion.div
            variants={staggerItem}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              padding: "var(--space-3)",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-sharp)",
            }}
          >
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label)",
              fontWeight: 500,
              color: activeTheme === "custom" ? "var(--color-text-display)" : "var(--color-text-disabled)",
            }}>
              Custom
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
              <div>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", display: "block", marginBottom: "var(--space-1)" }}>
                  Background
                </span>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: customBg, border: "1px solid var(--color-border-strong)", flexShrink: 0 }} />
                  <input
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    onBlur={applyCustom}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCustom(); }}
                    style={inputStyle}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", display: "block", marginBottom: "var(--space-1)" }}>
                  Text
                </span>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: customText, border: "1px solid var(--color-border-strong)", flexShrink: 0 }} />
                  <input
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onBlur={applyCustom}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCustom(); }}
                    style={inputStyle}
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
