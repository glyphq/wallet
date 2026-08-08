import { useState, useEffect, useMemo, type ReactNode } from "react";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useNetworkHealth } from "@/hooks/use-network-health";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useUpdater } from "@/hooks/use-updater";
import { formatDate } from "@/lib/format";
import { saveFileDialog } from "@/lib/save-file";
import { AltArrowDown, AltArrowUp } from "@solar-icons/react";
import {
  getBatteryInfo,
  getDeviceInfo,
  getDisplayInfo,
  getNetworkInfo,
  getStorageInfo,
} from "tauri-plugin-device-info-api";

const STATUS_STYLES: Record<string, { color: string; label: string; summary: string }> = {
  healthy: { color: "var(--color-status-success)", label: "Connected", summary: "Glyph is receiving live network data." },
  degraded: { color: "var(--color-status-warning)", label: "Slow connection", summary: "Live network data is taking longer than usual." },
  offline: { color: "var(--color-status-error)", label: "Offline", summary: "Glyph cannot currently reach the network." },
};

interface DeviceDiagnostics {
  device: string | null;
  battery: string | null;
  network: string | null;
  storage: string | null;
  display: string | null;
}

function cspModeLabel() {
  return import.meta.env.DEV ? "Development" : "Strict";
}

function cspModeDetail() {
  return import.meta.env.DEV
    ? "Vite dev server active. Packaged CSP is not enforced by the development host."
    : "Packaged connections are limited to self, IPC, and HTTPS endpoints.";
}

export default function DiagnosticsScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const runtimeIssues = usePersistedStore((s) => s.runtimeIssues);
  const clearRuntimeIssues = usePersistedStore((s) => s.clearRuntimeIssues);
  const auditEvents = usePersistedStore((s) => s.auditEvents);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const vaults = usePersistedStore((s) => s.vaults);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingRequestCount = useSessionStore((s) => s.pendingRequests.length);

  const networkHealth = useNetworkHealth();
  const { data: tickInfo, dataUpdatedAt: tickUpdatedAt } = useTickInfo();
  const { data: lastProcessedTick } = useLastProcessedTick();
  const { data: latestStats } = useLatestStats();
  const updater = useUpdater();

  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageQuota, setStorageQuota] = useState<number | null>(null);
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<DeviceDiagnostics | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate().then(({ usage, quota }) => {
      setStorageUsed(usage ?? null);
      setStorageQuota(quota ?? null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getDeviceInfo(), getBatteryInfo(), getNetworkInfo(), getStorageInfo(), getDisplayInfo()])
      .then(([device, battery, network, storage, display]) => {
        if (cancelled) return;
        const deviceLabel = [device.device_name, device.manufacturer, device.model]
          .filter((value): value is string => Boolean(value))
          .join(" · ");
        const batteryLabel = battery.level == null ? null : `${Math.round(battery.level)}%${battery.isCharging ? " · Charging" : ""}`;
        const storageLabel = storage.totalSpace == null || storage.freeSpace == null ? null : `${formatBytes(storage.freeSpace)} free of ${formatBytes(storage.totalSpace)}`;
        const displayLabel = display.width == null || display.height == null ? null : `${display.width} × ${display.height}${display.refreshRate == null ? "" : ` · ${display.refreshRate} Hz`}`;
        setDeviceDiagnostics({ device: deviceLabel || null, battery: batteryLabel, network: network.networkType ?? null, storage: storageLabel, display: displayLabel });
      })
      .catch(() => { if (!cancelled) setDeviceDiagnostics(null); });
    return () => { cancelled = true; };
  }, []);

  const totalAccounts = useMemo(() => vaults.reduce((sum, vault) => sum + vault.accounts.length, 0), [vaults]);
  const recentIssues = runtimeIssues.slice(0, 10);
  const syncDiff = tickInfo?.tick != null && lastProcessedTick?.tickNumber != null ? tickInfo.tick - lastProcessedTick.tickNumber : null;
  const status = STATUS_STYLES[networkHealth] ?? STATUS_STYLES.offline;
  const tickAge = tickUpdatedAt ? Math.round((Date.now() - tickUpdatedAt) / 1000) : null;

  const bundle = useMemo(() => ({
    exportedAt: new Date().toISOString(),
    appVersion: updater.appVersion,
    updater: {
      platform: updater.context?.platform ?? null,
      packageKind: updater.context?.packageKind ?? null,
      supported: updater.context?.supportsAutoUpdate ?? null,
      reason: updater.context?.reason ?? null,
      checking: updater.checking,
      upToDate: updater.upToDate,
      updateVersion: updater.update?.version ?? null,
      installing: updater.installing,
      progress: updater.progress,
      lastCheckedAt: updater.lastCheckedAt,
      lastError: updater.lastError,
    },
    csp: { mode: cspModeLabel(), detail: cspModeDetail() },
    device: deviceDiagnostics,
    runtime: {
      pendingRequestQueueLength: pendingRequestCount,
      pendingTransactionCount: pendingTxs.length,
      runtimeIssues: recentIssues,
      recentAuditEvents: auditEvents.slice(0, 25),
    },
    network: {
      liveApiUrl: settings.network.liveApiUrl,
      queryApiUrl: settings.network.queryApiUrl,
      currentTick: tickInfo?.tick ?? null,
      epoch: tickInfo?.epoch ?? null,
      lastProcessedTick: lastProcessedTick?.tickNumber ?? null,
      latestPriceUsd: latestStats?.price ?? null,
      activeAddresses: latestStats?.activeAddresses ?? null,
    },
    counts: { vaults: vaults.length, contacts: contacts.length, accounts: totalAccounts },
    settings: { ...settings, exportSigningPrivateJwk: settings.exportSigningPrivateJwk ? "[redacted]" : null },
    exportSigningKey: usePersistedStore.getState().exportSigningKey ? "[redacted]" : null,
  }), [auditEvents, contacts.length, deviceDiagnostics, lastProcessedTick?.tickNumber, latestStats?.activeAddresses, latestStats?.price, pendingRequestCount, pendingTxs.length, recentIssues, settings, tickInfo?.epoch, tickInfo?.tick, totalAccounts, updater, vaults.length]);

  async function exportBundle() {
    await saveFileDialog(`glyph-debug-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2));
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}>
      <motion.main {...stepMotion} style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Diagnostics" />

        <section aria-label="Overall status" style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, marginTop: 5, borderRadius: "50%", flexShrink: 0, background: status.color, boxShadow: `0 0 0 4px color-mix(in srgb, ${status.color} 15%, transparent)` }} />
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)" }}>{status.label}</strong>
            <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>{status.summary}</span>
          </div>
        </section>

        <DiagnosticSection title="Connection" description="Live chain connection and synchronization.">
          <DiagnosticRow label="Current tick" value={tickInfo?.tick != null ? String(tickInfo.tick) : "Waiting for data"} />
          <DiagnosticRow label="Synchronization" value={syncDiff != null ? `${syncDiff} tick${syncDiff === 1 ? "" : "s"} behind` : "Waiting for data"} tone={syncDiff != null && syncDiff > 5 ? "warning" : undefined} />
          <DiagnosticRow label="Last update" value={tickAge != null ? `${tickAge}s ago` : "Waiting for data"} />
          <DiagnosticRow label="Live RPC" value={settings.network.liveApiUrl} technical />
          <DiagnosticRow label="Archive RPC" value={settings.network.queryApiUrl} technical />
        </DiagnosticSection>

        <DiagnosticSection title="Wallet" description="Local wallet activity. No wallet secrets are included here.">
          <DiagnosticRow label="Vaults" value={String(vaults.length)} />
          <DiagnosticRow label="Accounts" value={String(totalAccounts)} />
          <DiagnosticRow label="Contacts" value={String(contacts.length)} />
          <DiagnosticRow label="Pending requests" value={pendingRequestCount > 0 ? String(pendingRequestCount) : "None"} tone={pendingRequestCount > 0 ? "warning" : undefined} />
          <DiagnosticRow label="Pending transactions" value={pendingTxs.length > 0 ? String(pendingTxs.length) : "None"} tone={pendingTxs.length > 0 ? "warning" : undefined} />
        </DiagnosticSection>

        {(latestStats || tickInfo?.epoch != null) && (
          <DiagnosticSection title="Network" description="Latest public network information.">
            {latestStats?.price != null && <DiagnosticRow label="QU price" value={`$${latestStats.price.toFixed(6)}`} />}
            {latestStats?.marketCap != null && latestStats.marketCap > 0 && <DiagnosticRow label="Market cap" value={`$${(latestStats.marketCap / 1e6).toFixed(1)}M`} />}
            {latestStats?.activeAddresses != null && <DiagnosticRow label="Active addresses" value={latestStats.activeAddresses.toLocaleString()} />}
            {tickInfo?.epoch != null && <DiagnosticRow label="Epoch" value={String(tickInfo.epoch)} />}
          </DiagnosticSection>
        )}

        <DiagnosticSection title="App and device" description="Version, update support, and available device information.">
          <DiagnosticRow label="Version" value={updater.appVersion || "Not available"} />
          <DiagnosticRow label="Platform" value={updater.context?.platform ?? "Not available"} />
          <DiagnosticRow label="Package" value={updater.context?.packageKind ?? "Not available"} />
          <DiagnosticRow label="Updates" value={updater.checking ? "Checking for updates" : updater.installing ? `Installing ${updater.progress}%` : updater.update ? `Update available: v${updater.update.version}` : updater.upToDate ? "Up to date" : updater.context?.supportsAutoUpdate ? "Ready to check" : "Not available"} tone={updater.checkError ? "error" : updater.update ? "warning" : undefined} />
          {storageUsed != null && storageQuota != null && <DiagnosticRow label="App storage" value={`${formatBytes(storageUsed)} of ${formatBytes(storageQuota)}`} />}
          <DiagnosticRow label="System" value={deviceDiagnostics?.device ?? "Native device details unavailable"} />
          {deviceDiagnostics?.battery && <DiagnosticRow label="Battery" value={deviceDiagnostics.battery} />}
          {deviceDiagnostics?.network && <DiagnosticRow label="Device connection" value={deviceDiagnostics.network} />}
          {deviceDiagnostics?.storage && <DiagnosticRow label="Disk" value={deviceDiagnostics.storage} />}
          {deviceDiagnostics?.display && <DiagnosticRow label="Display" value={deviceDiagnostics.display} />}
        </DiagnosticSection>

        <DiagnosticSection title="Runtime issues" description={recentIssues.length === 0 ? "No issues have been recorded during this session." : `${recentIssues.length} recent issue${recentIssues.length === 1 ? "" : "s"}.`}>
          {recentIssues.length === 0 ? (
            <DiagnosticRow label="Status" value="No issues recorded" tone="success" />
          ) : recentIssues.map((issue) => (
            <div key={issue.id} style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ color: "var(--color-text-primary)", fontSize: "var(--text-label)", fontWeight: 600 }}>{issue.title}</strong>
                <span style={{ flexShrink: 0, color: issue.source === "storage" ? "var(--color-status-error)" : issue.source === "updater" ? "var(--color-status-warning)" : "var(--color-text-secondary)", fontSize: "var(--text-caption)", textTransform: "capitalize" }}>{issue.source}</span>
              </div>
              <span style={{ display: "block", marginTop: 3, color: "var(--color-text-secondary)", fontSize: "var(--text-caption)", lineHeight: 1.45 }}>{issue.detail}</span>
              <span style={{ display: "block", marginTop: 4, color: "var(--color-text-disabled)", fontSize: "var(--text-caption)" }}>{formatDate(issue.createdAt)}</span>
            </div>
          ))}
          {runtimeIssues.length > 0 && <ActionRow label={`Clear ${runtimeIssues.length} runtime issue${runtimeIssues.length === 1 ? "" : "s"}`} onClick={clearRuntimeIssues} />}
        </DiagnosticSection>

        <DiagnosticSection title="Support" description="Export a redacted bundle when you need help troubleshooting.">
          <ActionRow label="Export debug bundle" detail="Includes app, network, update, and recent runtime state. Keys remain redacted." onClick={() => void exportBundle()} primary />
        </DiagnosticSection>

        <section style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)", paddingBottom: "var(--space-6)" }}>
          <motion.button
            {...gesture.pressSubtle}
            type="button"
            onClick={() => setShowTechnical((value) => !value)}
            aria-expanded={showTechnical}
            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: 0, background: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}
          >
            Technical details
            {showTechnical ? <AltArrowUp size={16} weight="Outline" aria-hidden="true" /> : <AltArrowDown size={16} weight="Outline" aria-hidden="true" />}
          </motion.button>
          <span style={{ display: "block", marginTop: 4, color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Security policy and update diagnostics for advanced troubleshooting.</span>
          {showTechnical && (
            <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
              <DiagnosticRow label="CSP mode" value={cspModeLabel()} />
              <DiagnosticRow label="CSP policy" value={cspModeDetail()} technical />
              <DiagnosticRow label="Last update check" value={formatDate(updater.lastCheckedAt) || "Never"} />
              <DiagnosticRow label="Update error" value={updater.lastError || (updater.checkError ? "Update check failed" : "None")} tone={updater.lastError || updater.checkError ? "error" : undefined} />
              <DiagnosticRow label="Debug mode" value={settings.debugMode ? "On" : "Off"} />
              <DiagnosticRow label="Blur-lock bypass" value={settings.allowBlurLockBypass ? "On" : "Off"} />
            </div>
          )}
        </section>
      </motion.main>
    </AppShell>
  );
}

function DiagnosticSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
      <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "var(--space-1) 0 var(--space-3)", color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.45 }}>{description}</p>
      <div>{children}</div>
    </section>
  );
}

function DiagnosticRow({ label, value, tone, technical = false }: { label: string; value: string; tone?: "success" | "warning" | "error"; technical?: boolean }) {
  const color = tone === "success" ? "var(--color-status-success)" : tone === "warning" ? "var(--color-status-warning)" : tone === "error" ? "var(--color-status-error)" : "var(--color-text-primary)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 0.8fr) minmax(0, 1.7fr)", gap: "var(--space-4)", alignItems: "baseline", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>{label}</span>
      <span style={{ minWidth: 0, color, textAlign: "right", overflowWrap: "anywhere", fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)", fontSize: technical ? "var(--text-caption)" : "var(--text-label)", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

function ActionRow({ label, detail, onClick, primary = false }: { label: string; detail?: string; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      type="button"
      onClick={onClick}
      style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center", padding: "var(--space-3) 0", border: "none", borderBottom: "1px solid var(--color-border-subtle)", background: "transparent", cursor: "pointer", textAlign: "left" }}
    >
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: "block", color: primary ? "var(--color-accent)" : "var(--color-text-primary)", fontSize: "var(--text-label)", fontWeight: 600 }}>{label}</strong>
        {detail && <span style={{ display: "block", marginTop: 2, color: "var(--color-text-secondary)", fontSize: "var(--text-caption)", lineHeight: 1.4 }}>{detail}</span>}
      </span>
      <span aria-hidden="true" style={{ color: primary ? "var(--color-accent)" : "var(--color-text-secondary)", fontSize: "var(--text-body)" }}>›</span>
    </motion.button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
