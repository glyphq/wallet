import { usePersistedStore, type ThemeMode } from "@/store/persisted";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { Sun, Moon, CheckCircle } from "@solar-icons/react";

const THEMES: { id: ThemeMode; label: string; description: string; Icon: typeof Sun }[] = [
  { id: "dark", label: "Dark", description: "Dark background with light text", Icon: Moon },
  { id: "light", label: "Light", description: "Light background with dark text", Icon: Sun },
];

export default function AppearanceScreen() {
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}>
        <SettingsPageHeader title="Appearance" />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {THEMES.map(({ id, label, description, Icon }) => {
            const selected = themeMode === id;
            return (
              <motion.button
                key={id}
                {...gesture.pressSubtle}
                onClick={() => updateSettings({ themeMode: id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-4)",
                  background: selected ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
                  borderRadius: "var(--radius-card)",
                  border: selected ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subtle)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span style={{ flexShrink: 0, color: selected ? "var(--color-text-primary)" : "var(--color-text-disabled)" }}>
                  <Icon size={22} weight={selected ? "Bold" : "Linear"} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {description}
                  </div>
                </div>
                {selected && (
                  <CheckCircle size={18} weight="Bold" style={{ flexShrink: 0, color: "var(--color-accent)" }} />
                )}
              </motion.button>
            );
          })}
        </div>

        <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3) var(--space-4)", background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border-subtle)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
            Theme changes apply immediately across all screens.
          </span>
        </div>
      </motion.div>
    </AppShell>
  );
}
