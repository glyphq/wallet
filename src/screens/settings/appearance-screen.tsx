import { motion } from "motion/react";
import { stepMotion, staggerContainer, staggerItem } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore, type FontPairId, type AccentColorId } from "@/store/persisted";
import { FONT_PAIRS, ACCENT_COLORS } from "@/lib/appearance";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-disabled)",
  letterSpacing: "0.08em",
};

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

export default function AppearanceScreen() {
  const fontPair = usePersistedStore((s) => s.settings.fontPair);
  const accentColor = usePersistedStore((s) => s.settings.accentColor);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

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

        {/* ── Accent ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <motion.span variants={staggerItem} style={labelStyle}>Accent</motion.span>
          <motion.div variants={staggerItem} style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {ACCENT_COLORS.map((ac) => (
              <button
                key={ac.id}
                onClick={() => updateSettings({ accentColor: ac.id as AccentColorId })}
                title={ac.name}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: ac.hex,
                  border: accentColor === ac.id ? "2px solid var(--color-text-display)" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
