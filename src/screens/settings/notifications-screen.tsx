import { motion } from "framer-motion";
import { Bell, EyeClosed, BellBing } from "@solar-icons/react";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";

function ToggleRow({ label, description, enabled, onToggle, disabled }: {
  label: string; description: string; enabled: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={() => !disabled && onToggle()} style={{
      display: "flex", alignItems: "center", gap: "var(--space-3)",
      padding: "var(--space-3) 0", width: "100%", background: "none", border: "none",
      cursor: disabled ? "default" : "pointer", textAlign: "left",
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>{description}</div>
      </div>
      <div style={{ width: 36, height: 20, borderRadius: "var(--radius-pill)", flexShrink: 0, position: "relative", background: enabled ? "var(--color-accent)" : "var(--color-border-strong)", transition: "background 0.15s ease" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: enabled ? "var(--color-bg-base)" : "var(--color-text-disabled)", position: "absolute", top: 2, left: enabled ? 18 : 2, transition: "left 0.15s ease" }} />
      </div>
    </button>
  );
}

export default function NotificationsScreen() {
  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);
  const onMissedConfirmations = usePersistedStore((s) => s.settings.notifyOnMissedConfirmations);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  function handleToggleEnabled(v: boolean) {
    updateSettings({ notificationsEnabled: v });
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minHeight: 0 }}
      >
        <SettingsPageHeader title="Notifications" />

        {/* Desktop notifications card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><Bell size={22} weight="Linear" /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Desktop notifications
            </span>
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="Notifications enabled"
            description="Show OS notifications for wallet events"
            enabled={enabled}
            onToggle={() => handleToggleEnabled(!enabled)}
          />
        </div>

        {/* Notify when card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><BellBing size={22} weight="Linear" /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Notify when
            </span>
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="QU received"
            description="Balance increases on any account in the active vault"
            enabled={onReceived}
            onToggle={() => updateSettings({ notifyOnReceived: !onReceived })}
            disabled={!enabled}
          />
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="Transaction sent"
            description="Any send, SC call, or burn is broadcast"
            enabled={onSent}
            onToggle={() => updateSettings({ notifyOnSent: !onSent })}
            disabled={!enabled}
          />
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="Transaction resolved"
            description="Pending tx confirms successfully on chain"
            enabled={onConfirmed}
            onToggle={() => updateSettings({ notifyOnConfirmed: !onConfirmed })}
            disabled={!enabled}
          />
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="Missed confirmations"
            description="Pending tx fails or expires before confirmation"
            enabled={onMissedConfirmations}
            onToggle={() => updateSettings({ notifyOnMissedConfirmations: !onMissedConfirmations })}
            disabled={!enabled}
          />
        </div>

        {/* Behavior card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><EyeClosed size={22} weight="Linear" /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Behavior
            </span>
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="Hide to tray on close"
            description="Keep Glyph running in the system tray when the window is closed"
            enabled={hideToTray}
            onToggle={() => updateSettings({ hideToTray: !hideToTray })}
          />
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            label="Notify when locked"
            description="Allow desktop notifications to appear while the vault is locked"
            enabled={notifyWhenLocked}
            onToggle={() => updateSettings({ notifyWhenLocked: !notifyWhenLocked })}
            disabled={!enabled}
          />
        </div>
      </motion.div>
    </AppShell>
  );
}
