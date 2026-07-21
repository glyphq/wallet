import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { SettingsSwitch } from "@/components/settings-switch";
import { usePersistedStore } from "@/store/persisted";

export default function NotificationsScreen() {
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);
  const onMissedConfirmations = usePersistedStore((s) => s.settings.notifyOnMissedConfirmations);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Notifications" />

        {/* Master toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSwitch label="Notifications" description="Show desktop notifications for wallet events" checked={enabled} onChange={() => updateSettings({ notificationsEnabled: !enabled })} />
        </div>

        <SettingsDivider />

        {/* Notify when */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Notify when</SettingsSectionLabel>
          <SettingsSwitch label="QU received" description="Balance increases on any account" checked={onReceived} onChange={() => updateSettings({ notifyOnReceived: !onReceived })} disabled={!enabled} />
          <SettingsDivider />
          <SettingsSwitch label="Transaction sent" description="Send, contract call, or burn is broadcast" checked={onSent} onChange={() => updateSettings({ notifyOnSent: !onSent })} disabled={!enabled} />
          <SettingsDivider />
          <SettingsSwitch label="Transaction confirmed" description="Pending transaction confirms on chain" checked={onConfirmed} onChange={() => updateSettings({ notifyOnConfirmed: !onConfirmed })} disabled={!enabled} />
          <SettingsDivider />
          <SettingsSwitch label="Missed confirmations" description="Pending transaction fails or expires" checked={onMissedConfirmations} onChange={() => updateSettings({ notifyOnMissedConfirmations: !onMissedConfirmations })} disabled={!enabled} />
        </div>

        <SettingsDivider />

        {/* Behavior */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Behavior</SettingsSectionLabel>
          <SettingsSwitch label="Hide to tray on close" description="Keep Glyph running in the system tray" checked={hideToTray} onChange={() => updateSettings({ hideToTray: !hideToTray })} />
          <SettingsDivider />
          <SettingsSwitch label="Notify when locked" description="Allow notifications while the vault is locked" checked={notifyWhenLocked} onChange={() => updateSettings({ notifyWhenLocked: !notifyWhenLocked })} disabled={!enabled} />
        </div>
      </motion.div>
    </AppShell>
  );
}
