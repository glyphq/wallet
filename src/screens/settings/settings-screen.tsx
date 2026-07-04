import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AltArrowLeft,
  AltArrowRight,
  ShieldCheck,
  WiFiRouterMinimalistic,
  Pallete,
  Earth,
  ClockCircle,
  UsersGroupRounded,
  Bell,
  Heart,
  Bug,
} from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { useUpdater } from "@/hooks/use-updater";
import { usePersistedStore } from "@/store/persisted";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

function autoLockLabel(minutes: number): string {
  if (minutes === 0) return "Never";
  if (minutes < 60) return `${minutes}m`;
  return `${minutes / 60}h`;
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { appVersion, context, update, checking, upToDate, checkError, installError, installing, progress, lastError, install } = useUpdater();
  const updaterSupported = context?.supportsAutoUpdate ?? true;

  const autoLockMinutes = usePersistedStore((s) => s.settings.autoLockMinutes);
  const notificationsEnabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const contacts = usePersistedStore((s) => s.contacts);
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps ?? []);

  const ROWS = [
    { label: "Security", description: `Auto-lock: ${autoLockLabel(autoLockMinutes)}`, route: "/settings/security", icon: <ShieldCheck size={22} weight="Linear" /> },
    { label: "Network", description: "RPC endpoints and developer mode", route: "/settings/network", icon: <WiFiRouterMinimalistic size={22} weight="Linear" /> },
    { label: "Appearance", description: "Fonts and accent color", route: "/settings/appearance", icon: <Pallete size={22} weight="Linear" /> },
    { label: "Approved dApps", description: approvedDapps.length ? `${approvedDapps.length} approved` : "No approved dApps", route: "/settings/dapps", icon: <Earth size={22} weight="Linear" /> },
    { label: "Request history", description: "Deep-link approvals and callbacks", route: "/settings/request-history", icon: <ClockCircle size={22} weight="Linear" /> },
    { label: "Contacts", description: contacts.length ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : "No contacts yet", route: "/settings/contacts", icon: <UsersGroupRounded size={22} weight="Linear" /> },
    { label: "Notifications", description: notificationsEnabled ? "Enabled" : "Disabled", route: "/settings/notifications", icon: <Bell size={22} weight="Linear" /> },
    { label: "Support", description: "Sponsors, donate QU, GitHub", route: "/settings/support", icon: <Heart size={22} weight="Linear" /> },
    { label: "Diagnostics", description: "Runtime state and debug bundle", route: "/settings/diagnostics", icon: <Bug size={22} weight="Linear" /> },
  ];

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", position: "relative", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => navigate("/dashboard")} style={{ position: "absolute", left: "var(--space-4)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
        <AltArrowLeft size={20} style={{ color: "var(--color-text-primary)" }} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
        Settings
      </span>
    </div>
  );

  return (
    <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}
      >
        {/* Settings rows */}
        {ROWS.map((row) => (
          <button
            key={row.route}
            onClick={() => navigate(row.route)}
            className="stagger-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-4)",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-card)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}>{row.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                {row.label}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                {row.description}
              </div>
            </div>
            <AltArrowRight size={14} color="var(--color-text-disabled)" weight="Linear" style={{ flexShrink: 0 }} />
          </button>
        ))}

        {/* Version + update */}
        <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {update && updaterSupported && (
            <button
              onClick={install}
              disabled={installing}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-4)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-status-success)",
                borderRadius: "var(--radius-card)",
                cursor: installing ? "default" : "pointer",
                width: "100%",
                opacity: installing ? 0.6 : 1,
              }}
            >
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-success)" }}>
                {installing
                  ? progress > 0 ? `Downloading... ${progress}%` : "Downloading..."
                  : `Update available — v${update.version}`}
              </span>
              {!installing && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-success)" }}>
                  Install
                </span>
              )}
            </button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ ...labelStyle, color: checkError ? "var(--color-status-error)" : "var(--color-text-disabled)" }}>
              {appVersion ? `v${appVersion}` : ""}
              {checking ? " Checking..." : ""}
              {upToDate ? " Up to date" : ""}
              {!checking && !updaterSupported ? " Auto-update not available" : ""}
              {checkError ? " Update check failed" : ""}
            </span>
            {!checking && !updaterSupported && context?.reason && (
              <span style={{ ...labelStyle, color: "var(--color-text-secondary)" }}>
                {context.reason}
              </span>
            )}
            {lastError && (checkError || installError || !updaterSupported) && (
              <span style={{ ...labelStyle, color: (checkError || installError) ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
                {lastError}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
