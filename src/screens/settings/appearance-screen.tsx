
import { motion } from "framer-motion";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore, type FontPairId, type AccentColorId } from "@/store/persisted";
import { FONT_PAIRS, ACCENT_COLORS } from "@/lib/appearance";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

function FontCard({ pair, selected, onSelect }: { pair: typeof FONT_PAIRS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? "var(--color-accent)" : "var(--color-bg-surface)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-3)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div style={{ fontFamily: pair.sans, fontSize: "var(--text-label)", fontWeight: 500, color: selected ? "var(--color-bg)" : "var(--color-text-primary)", lineHeight: 1.2 }}>
        {pair.name}
      </div>
      <div style={{ fontFamily: pair.mono, fontSize: "var(--text-caption)", color: selected ? "var(--color-bg)" : "var(--color-text-secondary)", marginTop: "var(--space-1)", letterSpacing: "0.04em" }}>
        MONO 0123
      </div>
    </button>
  );
}

export default function AppearanceScreen() {
  const fontPair = usePersistedStore((s) => s.settings.fontPair);
  const accentColor = usePersistedStore((s) => s.settings.accentColor);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <motion.div initial={{ y: 4 }} animate={{ y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <SettingsPageHeader title="Appearance" />

        {/* ── Font ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <span style={labelStyle}>Font</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
            {FONT_PAIRS.map((pair) => (
              <FontCard
                key={pair.id}
                pair={pair}
                selected={fontPair === pair.id}
                onSelect={() => updateSettings({ fontPair: pair.id as FontPairId })}
              />
            ))}
          </div>
        </div>

        {/* ── Accent ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <span style={labelStyle}>Accent</span>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
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
                  border: accentColor === ac.id ? "2px solid var(--color-accent)" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
