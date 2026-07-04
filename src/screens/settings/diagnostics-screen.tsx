import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useUpdater } from "@/hooks/use-updater";
import { formatDate } from "@/lib/format";
import { saveFileDialog } from "@/lib/save-file";

function cspModeLabel() {
  return import.meta.env.DEV
    ? "Dev server CSP"
    : "Packaged strict CSP";
}

function cspModeDetail() {
  return import.meta.env.DEV
    ? "Vite dev server active; packaged CSP not enforced by the dev host."
    : "connect-src is limited to self, ipc, and https endpoints in the packaged app.";
}

function buildRedactedSettings(settings: ReturnType<typeof usePersistedStore.getState>["settings"]) {
  return {
    ...settings,
    exportSigningPrivateJwk: settings.exportSigningPrivateJwk ? "[redacted]" : null,
  };
}

export default function DiagnosticsScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const runtimeIssues = usePersistedStore((s) => s.runtimeIssues);
  const clearRuntimeIssues = usePersistedStore((s) => s.clearRuntimeIssues);
  const notificationEvents = usePersistedStore((s) => s.notificationEvents);
  const auditEvents = usePersistedStore((s) => s.auditEvents);
  const requestHistory = usePersistedStore((s) => s.requestHistory);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const vaults = usePersistedStore((s) => s.vaults);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingRequestCount = useSessionStore((s) => s.pendingRequests.length);
  const { data: tickInfo } = useTickInfo();
  const { data: lastProcessedTick } = useLastProcessedTick();
  const { data: latestStats } = useLatestStats();
  const updater = useUpdater();

  const recentIssues = runtimeIssues.slice(0, 10);
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
    csp: {
      mode: cspModeLabel(),
      detail: cspModeDetail(),
    },
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
    counts: {
      vaults: vaults.length,
      contacts: contacts.length,
      notificationEvents: notificationEvents.length,
      requestHistory: requestHistory.length,
    },
    settings: buildRedactedSettings(settings),
  }), [
    auditEvents,
    contacts.length,
    lastProcessedTick?.tickNumber,
    latestStats?.activeAddresses,
    latestStats?.price,
    notificationEvents.length,
    pendingRequestCount,
    pendingTxs.length,
    recentIssues,
    requestHistory.length,
    settings,
    tickInfo?.epoch,
    tickInfo?.tick,
    updater.appVersion,
    updater.checking,
    updater.installing,
    updater.lastCheckedAt,
    updater.lastError,
    updater.progress,
    updater.upToDate,
    updater.update?.version,
    vaults.length,
  ]);

  async function exportBundle() {
    await saveFileDialog(
      `glyph-debug-bundle-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(bundle, null, 2),
    );
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div initial={{ y: 4 }} animate={{ y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Diagnostics" />
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <button
            onClick={exportBundle}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-accent)" }}
          >
            Export debug bundle
          </button>
          {runtimeIssues.length > 0 && (
            <button
              onClick={clearRuntimeIssues}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}
            >
              Clear runtime issues
            </button>
          )}
        </div>

        <Section title="Runtime">
          <InfoRow label="Diagnostics UI" value={settings.debugMode ? "Enabled" : "Disabled"} />
          <InfoRow label="Blur-lock bypass" value={settings.allowBlurLockBypass ? "Enabled" : "Disabled"} />
          <InfoRow label="Pending request queue" value={String(pendingRequestCount)} />
          <InfoRow label="Pending transactions" value={String(pendingTxs.length)} />
        </Section>

        <Section title="Network">
          <InfoRow label="Live RPC" value={settings.network.liveApiUrl} />
          <InfoRow label="Archive RPC" value={settings.network.queryApiUrl} />
          <InfoRow label="Current tick" value={tickInfo?.tick != null ? String(tickInfo.tick) : "—"} />
          <InfoRow label="Last processed tick" value={lastProcessedTick?.tickNumber != null ? String(lastProcessedTick.tickNumber) : "—"} />
          <InfoRow label="Price feed" value={latestStats?.price != null ? `$${latestStats.price.toFixed(4)}` : "—"} />
        </Section>

        <Section title="Security">
          <InfoRow label="CSP mode" value={cspModeLabel()} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5, overflowWrap: "break-word" }}>
            {cspModeDetail()}
          </div>
        </Section>

        <Section title="Updater">
          <InfoRow label="App version" value={updater.appVersion || "—"} />
          <InfoRow label="Platform" value={updater.context?.platform ?? "—"} />
          <InfoRow label="Package" value={updater.context?.packageKind ?? "—"} />
          <InfoRow label="Auto-update" value={updater.context ? (updater.context.supportsAutoUpdate ? "Supported" : "Unsupported") : "—"} />
          <InfoRow label="Status" value={
            updater.checking ? "Checking"
              : updater.installing ? `Installing (${updater.progress}%)`
              : updater.context && !updater.context.supportsAutoUpdate ? "Unavailable for this install"
              : updater.update ? `Update available: ${updater.update.version}`
              : updater.upToDate ? "Up to date"
              : updater.checkError ? "Check failed"
              : "Idle"
          } />
          <InfoRow label="Last checked" value={formatDate(updater.lastCheckedAt) || "—"} />
          {updater.context?.reason && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5, overflowWrap: "break-word" }}>
              {updater.context.reason}
            </div>
          )}
          {updater.lastError && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)", overflowWrap: "break-word" }}>
              {updater.lastError}
            </div>
          )}
        </Section>

        <Section title="Recent native errors">
          {recentIssues.length === 0 ? (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
              No runtime issues recorded
            </div>
          ) : (
            recentIssues.map((issue, index) => (
              <div key={issue.id}>
                {index > 0 && <div style={{ borderTop: "1px solid var(--color-border)" }} />}
                <div style={{ padding: "var(--space-3) 0", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {issue.title}
                    </span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: issue.source === "updater" ? "var(--color-status-warning)" : issue.source === "storage" ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
                      {issue.source}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                    {issue.detail}
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", color: "var(--color-text-disabled)" }}>
                    {formatDate(issue.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </Section>
      </motion.div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)" }}>
        {title}
      </span>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "baseline", minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)", textAlign: "right", flex: 1, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}
