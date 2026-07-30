import { usePersistedStore, type ThemeMode, type FontPairId } from "@/store/persisted";
import { FONT_PAIRS } from "@/lib/appearance";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { Sun, Moon } from "@solar-icons/react";

const THEMES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
];

export default function AppearanceScreen() {
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
  const fontPair = usePersistedStore((s) => s.settings.fontPair);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", minHeight: 0 }}>
        <SettingsPageHeader title="Appearance" />

        {/* Theme toggle group */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
            Theme
          </span>
          <div
            role="radiogroup"
            aria-label="Theme"
            style={{
              display: "flex",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--color-border-subtle)",
              padding: 3,
              gap: 2,
            }}
          >
            {THEMES.map(({ id, label, Icon }) => {
              const selected = themeMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateSettings({ themeMode: id })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    flex: 1,
                    padding: "var(--space-2) var(--space-3)",
                    minHeight: 40,
                    background: selected ? "var(--color-bg-elevated)" : "transparent",
                    borderRadius: "calc(var(--radius-control) - 2px)",
                    border: selected ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                    boxShadow: selected ? "var(--shadow-surface)" : "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-body)",
                    fontWeight: selected ? 500 : 400,
                    color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)",
                  }}
                >
                  <Icon size={16} weight="Linear" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font pair selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
            Font
          </span>
          <div style={{ position: "relative" }}>
            <select
              value={fontPair}
              onChange={(e) => updateSettings({ fontPair: e.target.value as FontPairId })}
              style={{
                width: "100%",
                minHeight: "var(--height-input)",
                padding: "var(--space-2) var(--space-3)",
                paddingRight: "var(--space-8)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-control)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                appearance: "none",
                outline: "none",
              }}
            >
              {FONT_PAIRS.map((pair) => (
                <option key={pair.id} value={pair.id}>
                  {pair.name}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: "var(--space-3)",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--color-text-tertiary)",
                fontSize: 10,
              }}
            >
              ▼
            </span>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
