import { usePersistedStore } from "@/store/persisted";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { OptionSelector } from "@/components/option-selector";
import { Toggle } from "@/components/toggle";

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "BTC", label: "BTC" },
] as const;

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const sectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
} as const;

export default function AppearanceScreen() {
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
  const hideBalances = usePersistedStore((s) => s.settings.hideBalances);
  const currency = usePersistedStore((s) => s.settings.currency);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", minHeight: 0 }}>
        <SettingsPageHeader title="Appearance" />

        <section style={sectionStyle} aria-label="Currency">
          <SettingsSectionLabel>Currency</SettingsSectionLabel>
          <OptionSelector
            label="Currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            columns={3}
            onChange={(id) => updateSettings({ currency: id })}
          />
        </section>

        <SettingsDivider fullBleed />

        <section style={sectionStyle} aria-label="Theme">
          <SettingsSectionLabel>Theme</SettingsSectionLabel>
          <OptionSelector
            label="Theme"
            value={themeMode}
            options={THEME_OPTIONS}
            columns={2}
            onChange={(id) => updateSettings({ themeMode: id })}
          />
        </section>

        <SettingsDivider fullBleed />

        <section style={sectionStyle} aria-label="Privacy">
          <SettingsSectionLabel>Privacy</SettingsSectionLabel>
          <Toggle
            checked={hideBalances}
            label="Hide balances"
            description="Mask wallet amounts until you turn this off."
            onChange={(checked) => updateSettings({ hideBalances: checked })}
          />
        </section>
      </motion.div>
    </AppShell>
  );
}
