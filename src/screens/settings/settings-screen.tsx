import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Bug01Icon,
  Clock01Icon,
  EarthIcon,
  InformationCircleIcon,
  LockKeyholeIcon,
  Notification01Icon,
  PaintBoardIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  Wifi01Icon,
} from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { SettingsMenuGroup, SettingsMenuRow } from "@/components/settings-section-elements";
import { stepMotion } from "@/lib/animations";
import { useUpdater } from "@/hooks/use-updater";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

function autoLockLabel(minutes: number): string {
  if (minutes === 0) return "Never";
  if (minutes < 60) return `${minutes}m`;
  return `${minutes / 60}h`;
}

const SECTIONS = ["General", "Manage", "Info"] as const;

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { appVersion, context, update, checking, upToDate, checkError, installError, installing, progress, lastError, install } = useUpdater();
  const updaterSupported = context?.supportsAutoUpdate ?? true;

  const autoLockMinutes = usePersistedStore((s) => s.settings.autoLockMinutes);
  const notificationsEnabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const contacts = usePersistedStore((s) => s.contacts);
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps ?? []);
  const lock = useSessionStore((s) => s.lock);

  const rows: Array<{ label: string; description: string; route: string; icon: React.ReactNode; section: (typeof SECTIONS)[number] }> = [
    { label: "Security", description: `Auto-lock · ${autoLockLabel(autoLockMinutes)}`, route: "/settings/security", icon: <ShieldCheckIcon size={18} strokeWidth={1.5} />, section: "General" },
    { label: "Appearance", description: "Theme, currency, privacy", route: "/settings/appearance", icon: <PaintBoardIcon size={18} strokeWidth={1.5} />, section: "General" },
    { label: "Network", description: "Glyph API · tick offset", route: "/settings/network", icon: <Wifi01Icon size={18} strokeWidth={1.5} />, section: "General" },
    { label: "Contacts", description: contacts.length ? `${contacts.length} saved` : "No contacts yet", route: "/settings/contacts", icon: <UserGroupIcon size={18} strokeWidth={1.5} />, section: "Manage" },
    { label: "Approved dApps", description: approvedDapps.length ? `${approvedDapps.length} approved` : "No approvals", route: "/settings/dapps", icon: <EarthIcon size={18} strokeWidth={1.5} />, section: "Manage" },
    { label: "Notifications", description: notificationsEnabled ? "Enabled" : "Disabled", route: "/settings/notifications", icon: <Notification01Icon size={18} strokeWidth={1.5} />, section: "Manage" },
    { label: "Request history", description: "Deep-link approvals and callbacks", route: "/settings/request-history", icon: <Clock01Icon size={18} strokeWidth={1.5} />, section: "Info" },
    { label: "Diagnostics", description: "Runtime state and debug bundle", route: "/settings/diagnostics", icon: <Bug01Icon size={18} strokeWidth={1.5} />, section: "Info" },
  ];

  const status = checkError
    ? "Update check failed"
    : !updaterSupported
      ? "Auto-update unavailable"
      : checking
        ? "Checking for updates"
        : upToDate
          ? "Up to date"
          : "";

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", padding: "var(--space-4)" }}>
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

          {update && updaterSupported ? (
            <section className="settings-update corner-frame" aria-label="Application update" style={{ borderColor: "var(--color-status-success)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <InformationCircleIcon size={18} strokeWidth={1.5} style={{ color: "var(--color-status-success)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-status-success)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {installing ? "Downloading update" : "Update available"}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
                    {installing
                      ? progress > 0 ? `${progress}%` : "Starting download"
                      : `v${update.version}`}
                  </span>
                </div>
                <Button size="sm" onClick={install} loading={installing} style={{ width: "auto" }}>
                  Install
                </Button>
              </div>
              {installing && progress > 0 ? (
                <div style={{ height: 2, background: "var(--color-border-subtle)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "100%", background: "var(--color-status-success)", transform: `scaleX(${progress / 100})`, transformOrigin: "left", transition: "transform 0.3s ease" }} />
                </div>
              ) : null}
            </section>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: "var(--space-1)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Build
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)" }}>
                {appVersion ? `v${appVersion}` : "—"}
              </span>
            </div>
            {status ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: checkError ? "var(--color-status-error)" : "var(--color-text-tertiary)" }}>
                {status}
              </span>
            ) : null}
            {lastError && (checkError || installError || !updaterSupported) ? (
              <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: checkError || installError ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
                {lastError}
              </span>
            ) : null}
          </div>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              lock();
              navigate("/lock", { replace: true });
            }}
          >
            <LockKeyholeIcon size={18} strokeWidth={1.5} aria-hidden="true" />
            Lock wallet
          </Button>
        </div>
      </motion.div>
    </AppShell>
  );
}
