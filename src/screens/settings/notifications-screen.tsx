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
import { previewNotificationSound } from "@/lib/notification-sounds";
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
  const notificationPosition = usePersistedStore((s) => s.settings.notificationPosition);
  const notificationDurationSecs = usePersistedStore((s) => s.settings.notificationDurationSecs);
  const notificationMaxVisible = usePersistedStore((s) => s.settings.notificationMaxVisible);
  const notificationSoundsEnabled = usePersistedStore((s) => s.settings.notificationSoundsEnabled);
  const notificationSoundVolume = usePersistedStore((s) => s.settings.notificationSoundVolume);
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
          <Toggle label="Notifications" description="Show Glyph notification windows for wallet events" checked={enabled} onChange={(checked) => updateSettings({ notificationsEnabled: checked })} />
        </div>

        {notificationTestStatus !== "idle" ? (
          <span role={notificationTestStatus === "failed" ? "alert" : "status"} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: notificationTestStatus === "failed" ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
            {notificationTestStatus === "sent" ? "Test notification shown." : "Test notification could not be shown."}
          </span>
        ) : null}

        <SettingsDivider fullBleed />

        {/* Notify when */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Notify when</SettingsSectionLabel>
          <Toggle label="QU received" description="Balance increases on any account" checked={onReceived} onChange={(checked) => updateSettings({ notifyOnReceived: checked })} disabled={!enabled} />
          <SettingsDivider fullBleed />
          <Toggle label="Transaction sent" description="Send or contract call is broadcast" checked={onSent} onChange={(checked) => updateSettings({ notifyOnSent: checked })} disabled={!enabled} />
          <SettingsDivider fullBleed />
          <Toggle label="Transaction confirmed" description="Pending transaction confirms on chain" checked={onConfirmed} onChange={(checked) => updateSettings({ notifyOnConfirmed: checked })} disabled={!enabled} />
          <SettingsDivider fullBleed />
          <Toggle label="Missed confirmations" description="Pending transaction fails or expires" checked={onMissedConfirmations} onChange={(checked) => updateSettings({ notifyOnMissedConfirmations: checked })} disabled={!enabled} />
        </div>

        <SettingsDivider fullBleed />

        {/* Notification window */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Notification window</SettingsSectionLabel>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
              A separate always-on-top window; independent of the main wallet.
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Position</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {([
                ["top-left", "Top left"],
                ["top-right", "Top right"],
                ["bottom-left", "Bottom left"],
                ["bottom-right", "Bottom right"],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={notificationPosition === value ? "primary" : "secondary"}
                  style={{ width: "auto" }}
                  aria-pressed={notificationPosition === value}
                  disabled={!enabled}
                  onClick={() => updateSettings({ notificationPosition: value })}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Visible for</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {[4, 6, 8, 10, 15].map((seconds) => (
                <Button
                  key={seconds}
                  size="sm"
                  variant={notificationDurationSecs === seconds ? "primary" : "secondary"}
                  style={{ width: "auto" }}
                  aria-pressed={notificationDurationSecs === seconds}
                  disabled={!enabled}
                  onClick={() => updateSettings({ notificationDurationSecs: seconds })}
                >
                  {seconds}s
                </Button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Maximum visible</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {[2, 3, 4, 5].map((count) => (
                <Button
                  key={count}
                  size="sm"
                  variant={notificationMaxVisible === count ? "primary" : "secondary"}
                  style={{ width: "auto" }}
                  aria-pressed={notificationMaxVisible === count}
                  disabled={!enabled}
                  onClick={() => updateSettings({ notificationMaxVisible: count })}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <SettingsDivider fullBleed />

        {/* Sound */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Sound</SettingsSectionLabel>
          <Toggle
            label="Play sounds"
            description="Play a terminal sound when a notification appears"
            checked={notificationSoundsEnabled}
            onChange={(checked) => updateSettings({ notificationSoundsEnabled: checked })}
            disabled={!enabled}
          />
          <SettingsDivider fullBleed />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Volume</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {(["low", "medium", "high"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={notificationSoundVolume === value ? "primary" : "secondary"}
                  style={{ width: "auto", textTransform: "capitalize" }}
                  aria-pressed={notificationSoundVolume === value}
                  disabled={!enabled || !notificationSoundsEnabled}
                  onClick={() => updateSettings({ notificationSoundVolume: value })}
                >
                  {value}
                </Button>
              ))}
              <Button
                size="sm"
                variant="secondary"
                style={{ width: "auto" }}
                disabled={!enabled || !notificationSoundsEnabled}
                onClick={previewNotificationSound}
              >
                Preview
              </Button>
            </div>
          </div>
        </div>

        <SettingsDivider fullBleed />

        {/* Behavior */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSectionLabel>Behavior</SettingsSectionLabel>
          <Toggle label="Hide to tray on close" description="Keep Glyph running in the system tray" checked={hideToTray} onChange={(checked) => updateSettings({ hideToTray: checked })} />
          <SettingsDivider fullBleed />
          <Toggle label="Launch at startup" description="Open Glyph automatically when you sign in" checked={autostartEnabled} onChange={() => void toggleAutostart()} disabled={!autostartReady || autostartPending} />
          <SettingsDivider fullBleed />
          <Toggle label="Show when locked" description="Allow notification windows while the wallet is locked" checked={notifyWhenLocked} onChange={(checked) => updateSettings({ notifyWhenLocked: checked })} disabled={!enabled} />
        </div>
      </motion.div>
      </PageFrame>
    </AppShell>
  );
}
