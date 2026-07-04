import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";

function Toggle({ label, description, enabled, onToggle, disabled }: {
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
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>{description}</div>
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: "var(--radius-pill)", flexShrink: 0, position: "relative",
        background: enabled ? "var(--color-accent)" : "var(--color-border-strong)",
        transition: "background 0.15s ease",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%",
          background: enabled ? "var(--color-bg-base)" : "var(--color-text-disabled)",
          position: "absolute", top: 2, left: enabled ? 18 : 2, transition: "left 0.15s ease",
        }} />
      </div>
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--color-border-subtle)" }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-disabled)",
      textTransform: "none", letterSpacing: "0.06em",
    }}>
      {children}
    </span>
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

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Notifications" />

        {/* Master toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <Toggle label="Notifications" description="Show desktop notifications for wallet events" enabled={enabled} onToggle={() => updateSettings({ notificationsEnabled: !enabled })} />
        </div>

        <Divider />

        {/* Notify when */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SectionLabel>Notify when</SectionLabel>
          <Toggle label="QU received" description="Balance increases on any account" enabled={onReceived} onToggle={() => updateSettings({ notifyOnReceived: !onReceived })} disabled={!enabled} />
          <Divider />
          <Toggle label="Transaction sent" description="Send, contract call, or burn is broadcast" enabled={onSent} onToggle={() => updateSettings({ notifyOnSent: !onSent })} disabled={!enabled} />
          <Divider />
          <Toggle label="Transaction confirmed" description="Pending transaction confirms on chain" enabled={onConfirmed} onToggle={() => updateSettings({ notifyOnConfirmed: !onConfirmed })} disabled={!enabled} />
          <Divider />
          <Toggle label="Missed confirmations" description="Pending transaction fails or expires" enabled={onMissedConfirmations} onToggle={() => updateSettings({ notifyOnMissedConfirmations: !onMissedConfirmations })} disabled={!enabled} />
        </div>

        <Divider />

        {/* Behavior */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SectionLabel>Behavior</SectionLabel>
          <Toggle label="Hide to tray on close" description="Keep Glyph running in the system tray" enabled={hideToTray} onToggle={() => updateSettings({ hideToTray: !hideToTray })} />
          <Divider />
          <Toggle label="Notify when locked" description="Allow notifications while the vault is locked" enabled={notifyWhenLocked} onToggle={() => updateSettings({ notifyWhenLocked: !notifyWhenLocked })} disabled={!enabled} />
        </div>
      </motion.div>
    </AppShell>
  );
}
