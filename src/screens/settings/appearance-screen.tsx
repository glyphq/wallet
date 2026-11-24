import { usePersistedStore } from "@/store/persisted";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { CurrencyPicker } from "./appearance/currency-picker";
import { SettingsToggleRow } from "./appearance/settings-toggle-row";
import { ThemePicker } from "./appearance/theme-picker";

export default function AppearanceScreen() {
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
  const hideBalances = usePersistedStore((s) => s.settings.hideBalances);
  const currency = usePersistedStore((s) => s.settings.currency);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-5) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", minHeight: 0 }}>
        <SettingsPageHeader title="Appearance" />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SettingsSectionLabel>Currency</SettingsSectionLabel>
          <CurrencyPicker value={currency} onChange={(id) => updateSettings({ currency: id })} />
        </div>

        <SettingsDivider />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SettingsSectionLabel>Theme</SettingsSectionLabel>
          <ThemePicker value={themeMode} onChange={(id) => updateSettings({ themeMode: id })} />
        </div>

        <SettingsDivider />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SettingsSectionLabel>Privacy</SettingsSectionLabel>
          <SettingsToggleRow
            checked={hideBalances}
            label="Hide balances"
            description="Mask wallet amounts until you turn this off."
            onChange={(checked) => updateSettings({ hideBalances: checked })}
          />
        </div>
      </motion.div>
    </AppShell>
  );
}
