import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { SettingsSwitch } from "@/components/settings-switch";
import { Button } from "@/components/button";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { usePersistedStore } from "@/store/persisted";
import { recordRuntimeIssue } from "@/lib/runtime-issues";

export default function NotificationsScreen() {
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);
  const onMissedConfirmations = usePersistedStore((s) => s.settings.notifyOnMissedConfirmations);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  const autostartEnabled = usePersistedStore((s) => s.settings.autostartEnabled);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const [autostartPending, setAutostartPending] = useState(false);
  const [autostartReady, setAutostartReady] = useState(false);
  const [notificationTestPending, setNotificationTestPending] = useState(false);
  const [notificationTestStatus, setNotificationTestStatus] = useState<"idle" | "sent" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;

    void isEnabled()
      .then((enabled) => {
        if (cancelled) return;
        if (enabled !== autostartEnabled) updateSettings({ autostartEnabled: enabled });
        setAutostartReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        recordRuntimeIssue({
          source: "native",
          title: "Startup registration unavailable",
          detail: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [autostartEnabled, updateSettings]);

  async function toggleAutostart() {
    setAutostartPending(true);
    try {
      if (autostartEnabled) {
        await disable();
      } else {
        await enable();
      }
      updateSettings({ autostartEnabled: !autostartEnabled });
    } catch (error) {
      recordRuntimeIssue({
        source: "native",
        title: "Startup registration could not be updated",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAutostartPending(false);
    }
  }

  async function sendNotificationTest() {
    setNotificationTestPending(true);
    setNotificationTestStatus("idle");
    try {
      const result = await publishNotificationEvent(createNotificationEvent({
        kind: "system",
        title: "Glyph notification test",
        body: "Desktop notifications are configured correctly.",
      }));
      if (!result || !result.ok) {
        setNotificationTestStatus("failed");
        recordRuntimeIssue({
          source: "native",
          title: "Notification test failed",
          detail: result?.ok === false ? result.message : "Desktop notifications are disabled.",
        });
        return;
      }
      setNotificationTestStatus("sent");
    } finally {
      setNotificationTestPending(false);
    }
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Notifications" />

        {/* Master toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSwitch label="Notifications" description="Show desktop notifications for Vault events" checked={enabled} onChange={() => updateSettings({ notificationsEnabled: !enabled })} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
            {notificationTestStatus === "sent" ? "Notification sent" : notificationTestStatus === "failed" ? "Notification could not be sent" : "Check desktop delivery"}
          </span>
          <Button size="sm" variant="secondary" style={{ width: "auto" }} onClick={() => void sendNotificationTest()} disabled={!enabled || notificationTestPending} loading={notificationTestPending}>
            Send test
          </Button>
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
          <SettingsSwitch label="Launch at startup" description="Open Glyph automatically when you sign in" checked={autostartEnabled} onChange={() => void toggleAutostart()} disabled={!autostartReady || autostartPending} />
          <SettingsDivider />
          <SettingsSwitch label="Notify when locked" description="Allow notifications while the vault is locked" checked={notifyWhenLocked} onChange={() => updateSettings({ notifyWhenLocked: !notifyWhenLocked })} disabled={!enabled} />
        </div>
      </motion.div>
    </AppShell>
  );
}
