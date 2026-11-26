import { useMemo } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { Download01Icon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { PageFrame } from "@/components/page-header";
import { SettingsDivider } from "@/components/settings-section-elements";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useNetworkHealth } from "@/hooks/use-network-health";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useUpdater } from "@/hooks/use-updater";
import { DiagnosticRow, DiagnosticSection } from "./diagnostics/diagnostic-primitives";
import { AppDeviceSection } from "./diagnostics/app-device-section";
import { RuntimeIssuesSection } from "./diagnostics/runtime-issues-section";
import { useDebugBundle } from "./diagnostics/use-debug-bundle";
import { useDeviceDiagnostics } from "./diagnostics/use-device-diagnostics";

const HEALTH_LABEL = {
  healthy: { label: "Connected", tone: "success" as const },
  degraded: { label: "Slow connection", tone: "warning" as const },
  offline: { label: "Offline", tone: "error" as const },
};

export default function DiagnosticsScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const runtimeIssues = usePersistedStore((s) => s.runtimeIssues);
  const clearRuntimeIssues = usePersistedStore((s) => s.clearRuntimeIssues);
  const auditEvents = usePersistedStore((s) => s.auditEvents);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const wallets = usePersistedStore((s) => s.wallets);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingRequestCount = useSessionStore((s) => s.pendingRequests.length);

  const networkHealth = useNetworkHealth();
  const { data: tickInfo, dataUpdatedAt: tickUpdatedAt } = useTickInfo();
  const { data: lastProcessedTick } = useLastProcessedTick();
  const { data: latestStats } = useLatestStats();
  const updater = useUpdater();
  const { storageUsed, storageQuota, deviceDiagnostics } = useDeviceDiagnostics();

  const totalAccounts = useMemo(() => wallets.reduce((sum, wallet) => sum + wallet.accounts.length, 0), [wallets]);
  const recentIssues = runtimeIssues.slice(0, 10);
  const syncDiff = tickInfo?.tick != null && lastProcessedTick?.tickNumber != null ? tickInfo.tick - lastProcessedTick.tickNumber : null;
  const tickAge = tickUpdatedAt ? Math.round((Date.now() - tickUpdatedAt) / 1000) : null;
  const health = HEALTH_LABEL[networkHealth] ?? HEALTH_LABEL.offline;

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
    walletsCount: wallets.length,
  });

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <SettingsPageHeader title="Diagnostics" />
      <PageFrame
        actions={<Button size="md" style={{ width: "100%" }} onClick={() => void exportBundle()}>
          <Download01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          Export debug bundle
        </Button>}
      >
        <motion.main {...stepMotion} style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <DiagnosticSection title="Connection">
            <DiagnosticRow label="Status" value={health.label} tone={health.tone} />
            <DiagnosticRow label="Current tick" value={tickInfo?.tick != null ? String(tickInfo.tick) : "Waiting for data"} />
            {tickInfo?.epoch != null ? <DiagnosticRow label="Epoch" value={String(tickInfo.epoch)} /> : null}
            <DiagnosticRow label="Synchronization" value={syncDiff != null ? `${syncDiff} tick${syncDiff === 1 ? "" : "s"} behind` : "Waiting for data"} tone={syncDiff != null && syncDiff > 5 ? "warning" : undefined} />
            <DiagnosticRow label="Last update" value={tickAge != null ? `${tickAge}s ago` : "Waiting for data"} />
            <DiagnosticRow label="Glyph API" value={settings.network.apiUrl} technical />
          </DiagnosticSection>

          <SettingsDivider fullBleed />

          <DiagnosticSection title="Wallet">
            <DiagnosticRow label="Wallets" value={String(wallets.length)} />
            <DiagnosticRow label="Accounts" value={String(totalAccounts)} />
            <DiagnosticRow label="Contacts" value={String(contacts.length)} />
            <DiagnosticRow label="Pending requests" value={pendingRequestCount > 0 ? String(pendingRequestCount) : "None"} tone={pendingRequestCount > 0 ? "warning" : undefined} />
            <DiagnosticRow label="Pending transactions" value={pendingTxs.length > 0 ? String(pendingTxs.length) : "None"} tone={pendingTxs.length > 0 ? "warning" : undefined} />
          </DiagnosticSection>

          <SettingsDivider fullBleed />

          <AppDeviceSection
            updater={updater}
            deviceDiagnostics={deviceDiagnostics}
            storageUsed={storageUsed}
            storageQuota={storageQuota}
          />

          <SettingsDivider fullBleed />

          <RuntimeIssuesSection
            issues={recentIssues}
            totalCount={runtimeIssues.length}
            onClear={clearRuntimeIssues}
          />
        </motion.main>
      </PageFrame>
    </AppShell>
  );
}
