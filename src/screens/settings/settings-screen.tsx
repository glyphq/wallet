import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Bug01Icon,
  Clock01Icon,
  Download01Icon,
  LockKeyholeIcon,
  Notification01Icon,
  PaintBoardIcon,
  RefreshIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  Wifi01Icon,
} from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { PageFrame } from "@/components/page-header";
import { SettingsDivider, SettingsMenuGroup, SettingsMenuRow, SettingsSectionLabel } from "@/components/settings-section-elements";
import { stepMotion } from "@/lib/animations";
import { useUpdater } from "@/hooks/use-updater";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

function autoLockLabel(minutes: number): string {
  if (minutes === 0) return "Never";
  if (minutes < 60) return `${minutes}m`;
  return `${minutes / 60}h`;
}

function BuildRow({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "error" }) {
  const color = tone === "success" ? "var(--color-status-success)" : tone === "warning" ? "var(--color-status-warning)" : tone === "error" ? "var(--color-status-error)" : "var(--color-text-secondary)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", gap: "var(--space-4)", alignItems: "baseline", padding: "var(--space-2) 0" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

const SECTIONS = ["General", "Manage", "Info"] as const;

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { appVersion, context, update, checking, upToDate, checkError, installError, installing, progress, lastError, install, checkForUpdates } = useUpdater();
  const updaterSupported = context?.supportsAutoUpdate ?? true;

  const autoLockMinutes = usePersistedStore((s) => s.settings.autoLockMinutes);
  const notificationsEnabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const contacts = usePersistedStore((s) => s.contacts);
  const lock = useSessionStore((s) => s.lock);

  const rows: Array<{ label: string; description: string; route: string; icon: React.ReactNode; section: (typeof SECTIONS)[number] }> = [
    { label: "Security", description: `Auto-lock · ${autoLockLabel(autoLockMinutes)}`, route: "/settings/security", icon: <ShieldCheckIcon size={18} strokeWidth={1.5} />, section: "General" },
    { label: "Appearance", description: "Theme, currency, privacy", route: "/settings/appearance", icon: <PaintBoardIcon size={18} strokeWidth={1.5} />, section: "General" },
    { label: "Network", description: "Glyph API · tick offset", route: "/settings/network", icon: <Wifi01Icon size={18} strokeWidth={1.5} />, section: "General" },
    { label: "Contacts", description: contacts.length ? `${contacts.length} saved` : "No contacts yet", route: "/settings/contacts", icon: <UserGroupIcon size={18} strokeWidth={1.5} />, section: "Manage" },
    { label: "Notifications", description: notificationsEnabled ? "Enabled" : "Disabled", route: "/settings/notifications", icon: <Notification01Icon size={18} strokeWidth={1.5} />, section: "Manage" },
    { label: "Request history", description: "Deep-link approvals and callbacks", route: "/settings/request-history", icon: <Clock01Icon size={18} strokeWidth={1.5} />, section: "Info" },
    { label: "Diagnostics", description: "Runtime state and debug bundle", route: "/settings/diagnostics", icon: <Bug01Icon size={18} strokeWidth={1.5} />, section: "Info" },
  ];

  const updateStatus = !updaterSupported
    ? "Auto-update unavailable"
    : checking
      ? "Checking"
      : checkError
        ? "Check failed"
        : upToDate
          ? "Up to date"
          : update
            ? null
            : "Not checked";
  const updateTone: "success" | "warning" | "error" | undefined = checkError
    ? "error"
    : upToDate
      ? "success"
      : undefined;

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <PageFrame
        actions={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {update && updaterSupported ? (
              <Button size="md" style={{ width: "100%" }} onClick={() => void install()} loading={installing}>
                <Download01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                {installing ? progress > 0 ? `Installing · ${progress}%` : "Installing" : `Install v${update.version}`}
              </Button>
            ) : null}
            <Button
              variant={update && updaterSupported ? "secondary" : "primary"}
              size="md"
              onClick={() => {
                lock();
                navigate("/lock", { replace: true });
              }}
            >
              <LockKeyholeIcon size={16} strokeWidth={1.5} aria-hidden="true" />
              Lock wallet
            </Button>
          </div>
        )}
      >
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {SECTIONS.map((section) => (
            <SettingsMenuGroup key={section} label={section}>
              {rows.filter((row) => row.section === section).map((row) => (
                <SettingsMenuRow
                  key={row.route}
                  label={row.label}
                  description={row.description}
                  icon={row.icon}
                  onClick={() => navigate(row.route)}
                />
              ))}
            </SettingsMenuGroup>
          ))}

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} aria-label="Build and updates">
            <SettingsSectionLabel>Build</SettingsSectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <BuildRow label="Version" value={appVersion ? `v${appVersion}` : "—"} />
              {updateStatus ? <BuildRow label="Updates" value={updateStatus} tone={updateTone} /> : null}
            </div>

            {!update ? (
              <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => void checkForUpdates()} loading={checking} disabled={!updaterSupported}>
                <RefreshIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                {checking ? "Checking for updates" : "Check for updates"}
              </Button>
            ) : null}

            {lastError && (checkError || installError || !updaterSupported) ? (
              <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: checkError || installError ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
                {lastError}
              </span>
            ) : null}
          </section>
        </motion.div>
      </PageFrame>
    </AppShell>
  );
}
