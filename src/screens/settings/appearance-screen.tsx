import type { ReactNode } from "react";
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

function SettingsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-caption)",
      fontWeight: 600,
      color: "var(--color-text-disabled)",
      letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}

function SettingsDivider() {
  return <div style={{ height: 1, background: "var(--color-border-subtle)" }} />;
}

export default function AppearanceScreen() {
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
  const fontPair = usePersistedStore((s) => s.settings.fontPair);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", minHeight: 0 }}>
        <SettingsPageHeader title="Appearance" />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>Theme</SettingsSectionLabel>
          <div role="radiogroup" aria-label="Theme" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {THEMES.map(({ id, label, Icon }, index) => {
              const selected = themeMode === id;
              return (
                <div key={id}>
                  {index > 0 && <SettingsDivider />}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateSettings({ themeMode: id })}
                    style={{
                      width: "100%",
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      padding: "var(--space-2) 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      fontWeight: selected ? 600 : 400,
                      color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Icon size={16} weight="Linear" aria-hidden="true" />
                      {label}
                    </span>
                    <span style={{ fontSize: "var(--text-caption)", color: selected ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                      {selected ? "Selected" : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <SettingsDivider />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>Font</SettingsSectionLabel>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 44 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)" }}>
              Interface font
            </span>
            <span style={{ position: "relative", flex: "0 1 190px" }}>
              <select
                aria-label="Interface font"
                value={fontPair}
                onChange={(e) => updateSettings({ fontPair: e.target.value as FontPairId })}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: "0 var(--space-7) 0 var(--space-3)",
                  background: "var(--color-bg-input)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-control)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  color: "var(--color-text-primary)",
                  cursor: "pointer",
                  appearance: "none",
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
                  fontSize: "var(--text-caption)",
                }}
              >
                ▾
              </span>
            </span>
          </label>
        </div>
      </motion.div>
    </AppShell>
  );
}
