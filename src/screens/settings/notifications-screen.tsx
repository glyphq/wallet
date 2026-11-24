import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { PageFrame } from "@/components/page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { Toggle } from "@/components/toggle";
import { Button } from "@/components/button";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { usePersistedStore } from "@/store/persisted";
import { recordRuntimeIssue } from "@/lib/runtime-issues";
import { Notification01Icon } from "@/lib/icons";

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
      .then((registered) => {
        if (cancelled) return;
        if (registered !== autostartEnabled) updateSettings({ autostartEnabled: registered });
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
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <PageFrame
        actions={(
          <Button size="md" style={{ width: "100%" }} onClick={() => void sendNotificationTest()} disabled={!enabled || notificationTestPending} loading={notificationTestPending}>
            <Notification01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            Send test notification
          </Button>
        )}
      >
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Notifications" />

        {/* Master toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <Toggle label="Notifications" description="Show desktop notifications for wallet events" checked={enabled} onChange={(checked) => updateSettings({ notificationsEnabled: checked })} />
        </div>

        {notificationTestStatus !== "idle" ? (
          <span role={notificationTestStatus === "failed" ? "alert" : "status"} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: notificationTestStatus === "failed" ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
            {notificationTestStatus === "sent" ? "Test notification sent." : "Test notification could not be sent."}
          </span>
        ) : null}

        <SettingsDivider fullBleed />

        {/* Notify when */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Notify when</SettingsSectionLabel>
          <Toggle label="QU received" description="Balance increases on any account" checked={onReceived} onChange={(checked) => updateSettings({ notifyOnReceived: checked })} disabled={!enabled} />
          <SettingsDivider fullBleed />
          <Toggle label="Transaction sent" description="Send, contract call, or burn is broadcast" checked={onSent} onChange={(checked) => updateSettings({ notifyOnSent: checked })} disabled={!enabled} />
          <SettingsDivider fullBleed />
          <Toggle label="Transaction confirmed" description="Pending transaction confirms on chain" checked={onConfirmed} onChange={(checked) => updateSettings({ notifyOnConfirmed: checked })} disabled={!enabled} />
          <SettingsDivider fullBleed />
          <Toggle label="Missed confirmations" description="Pending transaction fails or expires" checked={onMissedConfirmations} onChange={(checked) => updateSettings({ notifyOnMissedConfirmations: checked })} disabled={!enabled} />
        </div>

        <SettingsDivider fullBleed />

        {/* Behavior */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Behavior</SettingsSectionLabel>
          <Toggle label="Hide to tray on close" description="Keep Glyph running in the system tray" checked={hideToTray} onChange={(checked) => updateSettings({ hideToTray: checked })} />
          <SettingsDivider fullBleed />
          <Toggle label="Launch at startup" description="Open Glyph automatically when you sign in" checked={autostartEnabled} onChange={() => void toggleAutostart()} disabled={!autostartReady || autostartPending} />
          <SettingsDivider fullBleed />
          <Toggle label="Notify when locked" description="Allow notifications while the wallet is locked" checked={notifyWhenLocked} onChange={(checked) => updateSettings({ notifyWhenLocked: checked })} disabled={!enabled} />
        </div>
      </motion.div>
      </PageFrame>
    </AppShell>
  );
}
