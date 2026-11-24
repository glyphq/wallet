import { useMemo } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useNetworkHealth } from "@/hooks/use-network-health";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useUpdater } from "@/hooks/use-updater";
import { ActionRow, DiagnosticRow, DiagnosticSection } from "./diagnostics/diagnostic-primitives";
import { AppDeviceSection } from "./diagnostics/app-device-section";
import { NetworkStatusSummary } from "./diagnostics/status-summary";
import { RuntimeIssuesSection } from "./diagnostics/runtime-issues-section";
import { TechnicalDetails } from "./diagnostics/technical-details";
import { useDebugBundle } from "./diagnostics/use-debug-bundle";
import { useDeviceDiagnostics } from "./diagnostics/use-device-diagnostics";

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
  const { storageUsed, storageQuota, deviceDiagnostics } = useDeviceDiagnostics();

  const totalAccounts = useMemo(() => vaults.reduce((sum, vault) => sum + vault.accounts.length, 0), [vaults]);
  const recentIssues = runtimeIssues.slice(0, 10);
  const syncDiff = tickInfo?.tick != null && lastProcessedTick?.tickNumber != null ? tickInfo.tick - lastProcessedTick.tickNumber : null;
  const tickAge = tickUpdatedAt ? Math.round((Date.now() - tickUpdatedAt) / 1000) : null;

  const { exportBundle } = useDebugBundle({
    auditEvents,
    contactsCount: contacts.length,
    deviceDiagnostics,
    lastProcessedTick: lastProcessedTick?.tickNumber ?? null,
    latestStats,
    pendingRequestCount,
    pendingTxCount: pendingTxs.length,
    recentIssues,
    settings,
    tickInfo,
    totalAccounts,
    updater,
    vaultsCount: vaults.length,
  });

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}>
      <motion.main {...stepMotion} style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Diagnostics" />

        <NetworkStatusSummary health={networkHealth} />

        <DiagnosticSection title="Connection" description="Live chain connection and synchronization.">
          <DiagnosticRow label="Current tick" value={tickInfo?.tick != null ? String(tickInfo.tick) : "Waiting for data"} />
          <DiagnosticRow label="Synchronization" value={syncDiff != null ? `${syncDiff} tick${syncDiff === 1 ? "" : "s"} behind` : "Waiting for data"} tone={syncDiff != null && syncDiff > 5 ? "warning" : undefined} />
          <DiagnosticRow label="Last update" value={tickAge != null ? `${tickAge}s ago` : "Waiting for data"} />
          <DiagnosticRow label="Glyph API" value={settings.network.apiUrl} technical />
        </DiagnosticSection>

        <DiagnosticSection title="Vault" description="Local Vault activity. No wallet secrets are included here.">
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

        <AppDeviceSection
          updater={updater}
          deviceDiagnostics={deviceDiagnostics}
          storageUsed={storageUsed}
          storageQuota={storageQuota}
        />

        <RuntimeIssuesSection
          issues={recentIssues}
          totalCount={runtimeIssues.length}
          onClear={clearRuntimeIssues}
        />

        <DiagnosticSection title="Support" description="Export a redacted bundle when you need help troubleshooting.">
          <ActionRow label="Export debug bundle" detail="Includes app, network, update, and recent runtime state. Keys remain redacted." onClick={() => void exportBundle()} primary />
        </DiagnosticSection>

        <TechnicalDetails updater={updater} settings={settings} />
      </motion.main>
    </AppShell>
  );
}
