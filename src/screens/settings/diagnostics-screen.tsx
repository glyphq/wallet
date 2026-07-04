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

/* ── Types ─────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  healthy: { bg: "rgba(52,199,89,0.12)", color: "#34c759", label: "Connected" },
  degraded: { bg: "rgba(255,159,10,0.12)", color: "#ff9f0a", label: "Slow" },
  offline: { bg: "rgba(255,59,48,0.12)", color: "#ff3b30", label: "Offline" },
};

function cspModeLabel() {
  return import.meta.env.DEV ? "Development" : "Strict";
}

function cspModeDetail() {
  return import.meta.env.DEV
    ? "Vite dev server active; packaged CSP not enforced by the dev host."
    : "connect-src is limited to self, ipc, and https endpoints in the packaged app.";
}

/* ── Component ─────────────────────────────────────────────────── */

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
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate().then(({ usage, quota }) => {
      setStorageUsed(usage ?? null);
      setStorageQuota(quota ?? null);
    }).catch(() => {});
  }, []);

  const totalAccounts = useMemo(() => vaults.reduce((sum, v) => sum + v.accounts.length, 0), [vaults]);
  const recentIssues = runtimeIssues.slice(0, 10);

  const syncDiff = tickInfo?.tick != null && lastProcessedTick?.tickNumber != null
    ? tickInfo.tick - lastProcessedTick.tickNumber
    : null;

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
  }), [auditEvents, contacts.length, lastProcessedTick?.tickNumber, latestStats?.activeAddresses, latestStats?.price, pendingRequestCount, pendingTxs.length, recentIssues, settings, tickInfo?.epoch, tickInfo?.tick, totalAccounts, updater, vaults.length]);

  async function exportBundle() {
    await saveFileDialog(
      `glyph-debug-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(bundle, null, 2),
    );
  }

  const status = STATUS_STYLES[networkHealth] ?? STATUS_STYLES.offline;
  const tickAge = tickUpdatedAt ? Math.round((Date.now() - tickUpdatedAt) / 1000) : null;

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Diagnostics" />

        {/* ── Connection ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>Connection</CardHeader>
          <Row label="Status" right={
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
              padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-pill)",
              background: status.bg, color: status.color,
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} />
              {status.label}
            </span>
          } />
          <Row label="Current tick" value={tickInfo?.tick != null ? String(tickInfo.tick) : "—"} />
          <Row label="Last synced" value={syncDiff != null ? `${syncDiff} tick${syncDiff === 1 ? "" : "s"} behind` : "—"} />
          <Row label="Tick age" value={tickAge != null ? `${tickAge}s ago` : "—"} />
          <Row label="Live RPC" value={settings.network.liveApiUrl} />
          <Row label="Archive RPC" value={settings.network.queryApiUrl} />
        </Card>

        {/* ── Wallet ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>Wallet</CardHeader>
          <Row label="Vaults" value={String(vaults.length)} />
          <Row label="Accounts" value={String(totalAccounts)} />
          <Row label="Contacts" value={String(contacts.length)} />
          <Row label="Pending requests" value={pendingRequestCount > 0 ? String(pendingRequestCount) : "None"} />
          <Row label="Pending transactions" value={pendingTxs.length > 0 ? String(pendingTxs.length) : "None"} />
        </Card>

        {/* ── Network ────────────────────────────────────────────── */}
        {latestStats && (
          <Card>
            <CardHeader>Network</CardHeader>
            {latestStats.price != null && (
              <Row label="QU price" value={`$${latestStats.price.toFixed(6)}`} />
            )}
            {latestStats.marketCap != null && latestStats.marketCap > 0 && (
              <Row label="Market cap" value={`$${(latestStats.marketCap / 1e6).toFixed(1)}M`} />
            )}
            {latestStats.activeAddresses != null && (
              <Row label="Active addresses" value={latestStats.activeAddresses.toLocaleString()} />
            )}
            {tickInfo?.epoch != null && (
              <Row label="Epoch" value={String(tickInfo.epoch)} />
            )}
          </Card>
        )}

        {/* ── App ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>App</CardHeader>
          <Row label="Version" value={updater.appVersion || "—"} />
          <Row label="Platform" value={updater.context?.platform ?? "—"} />
          <Row label="Package" value={updater.context?.packageKind ?? "—"} />
          <Row label="Auto-update" value={updater.context?.supportsAutoUpdate ? "Supported" : "Not available"} />
          <Row label="Update status" value={
            updater.checking ? "Checking for updates..."
              : updater.installing ? `Installing... ${updater.progress}%`
              : updater.update ? `Update available: v${updater.update.version}`
              : updater.upToDate ? "Up to date"
              : updater.checkError ? "Check failed"
              : "Idle"
          } />
          {storageUsed != null && storageQuota != null && (
            <Row label="Storage" value={`${formatBytes(storageUsed)} / ${formatBytes(storageQuota)}`} />
          )}
          <Row label="CSP mode" value={cspModeLabel()} />
        </Card>

        {/* ── Actions ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>Actions</CardHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <motion.button
              {...gesture.pressSubtle}
              onClick={exportBundle}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                width: "100%", padding: "var(--space-3)", background: "transparent",
                border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                fontWeight: 500, color: "var(--color-accent)",
              }}
            >
              Export debug bundle
            </motion.button>
            {runtimeIssues.length > 0 && (
              <motion.button
                {...gesture.pressSubtle}
                onClick={clearRuntimeIssues}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--space-2)",
                  width: "100%", padding: "var(--space-3)", background: "transparent",
                  border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                  cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                  fontWeight: 500, color: "var(--color-text-secondary)",
                }}
              >
                Clear runtime issues ({runtimeIssues.length})
              </motion.button>
            )}
          </div>
        </Card>

        {/* ── Technical (collapsible) ─────────────────────────────── */}
        <Card>
          <motion.button
            {...gesture.pressSubtle}
            onClick={() => setShowTechnical((v) => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", background: "none", border: "none", cursor: "pointer",
            }}
          >
            <CardHeader style={{ padding: 0 }}>Technical details</CardHeader>
            {showTechnical
              ? <AltArrowUp size={14} weight="Outline" style={{ color: "var(--color-text-disabled)" }} />
              : <AltArrowDown size={14} weight="Outline" style={{ color: "var(--color-text-disabled)" }} />}
          </motion.button>

          {showTechnical && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
              {/* Runtime issues */}
              <div>
                <SubHeader>Recent native errors</SubHeader>
                {recentIssues.length === 0 ? (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
                    No issues recorded
                  </span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {recentIssues.map((issue) => (
                      <div key={issue.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "baseline" }}>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                            {issue.title}
                          </span>
                          <span style={{
                            fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                            padding: "1px var(--space-2)", borderRadius: "var(--radius-pill)",
                            background: issue.source === "updater" ? "rgba(255,159,10,0.1)" : issue.source === "storage" ? "rgba(255,59,48,0.1)" : "var(--color-bg-elevated)",
                            color: issue.source === "updater" ? "var(--color-status-warning)" : issue.source === "storage" ? "var(--color-status-error)" : "var(--color-text-disabled)",
                          }}>
                            {issue.source}
                          </span>
                        </div>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                          {issue.detail}
                        </span>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
                          {formatDate(issue.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CSP */}
              <div>
                <SubHeader>Content Security Policy</SubHeader>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {cspModeDetail()}
                </span>
              </div>

              {/* Debug info */}
              <div>
                <SubHeader>Debug info</SubHeader>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", lineHeight: 1.6 }}>
                  <div>lastCheckedAt: {formatDate(updater.lastCheckedAt) || "—"}</div>
                  <div>lastError: {updater.lastError || "—"}</div>
                  <div>checkError: {updater.checkError || "—"}</div>
                  <div>debugMode: {settings.debugMode ? "on" : "off"}</div>
                  <div>blurLockBypass: {settings.allowBlurLockBypass ? "on" : "off"}</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </AppShell>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Card({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
      background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
      padding: "var(--space-4)",
    }}>
      {children}
    </div>
  );
}

function CardHeader({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-disabled)",
      textTransform: "none", letterSpacing: "0.06em",
      ...style,
    }}>
      {children}
    </span>
  );
}

function SubHeader({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-secondary)",
      display: "block", marginBottom: "var(--space-2)",
    }}>
      {children}
    </span>
  );
}

function Row({ label, value, right }: { label: string; value?: string; right?: ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: "var(--space-3)",
      alignItems: "center", minHeight: 24,
    }}>
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
        color: "var(--color-text-secondary)", flexShrink: 0,
      }}>
        {label}
      </span>
      {right ?? (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)",
          color: "var(--color-text-primary)", textAlign: "right",
          flex: 1, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-all",
        }}>
          {value}
        </span>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
