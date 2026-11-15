import { useMemo } from "react";
import { usePersistedStore, type AppSettings, type AuditEvent, type RuntimeIssue } from "@/store/persisted";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useUpdater } from "@/hooks/use-updater";
import { saveFileDialog } from "@/lib/save-file";
import { cspModeDetail, cspModeLabel } from "./csp-mode";
import type { DeviceDiagnostics } from "./use-device-diagnostics";

/** Builds the redacted debug bundle shared with support. */
export function useDebugBundle({
  auditEvents,
  contactsCount,
  deviceDiagnostics,
  lastProcessedTick,
  latestStats,
  pendingRequestCount,
  pendingTxCount,
  recentIssues,
  settings,
  tickInfo,
  totalAccounts,
  updater,
  vaultsCount,
}: {
  auditEvents: AuditEvent[];
  contactsCount: number;
  deviceDiagnostics: DeviceDiagnostics | null;
  lastProcessedTick: number | null;
  latestStats: ReturnType<typeof useLatestStats>["data"];
  pendingRequestCount: number;
  pendingTxCount: number;
  recentIssues: RuntimeIssue[];
  settings: AppSettings;
  tickInfo: ReturnType<typeof useTickInfo>["data"];
  totalAccounts: number;
  updater: ReturnType<typeof useUpdater>;
  vaultsCount: number;
}) {
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
      pendingTransactionCount: pendingTxCount,
      runtimeIssues: recentIssues,
      recentAuditEvents: auditEvents.slice(0, 25),
    },
    network: {
      liveApiUrl: settings.network.liveApiUrl,
      queryApiUrl: settings.network.queryApiUrl,
      currentTick: tickInfo?.tick ?? null,
      epoch: tickInfo?.epoch ?? null,
      lastProcessedTick,
      latestPriceUsd: latestStats?.price ?? null,
      activeAddresses: latestStats?.activeAddresses ?? null,
    },
    counts: { vaults: vaultsCount, contacts: contactsCount, accounts: totalAccounts },
    settings: { ...settings, exportSigningPrivateJwk: settings.exportSigningPrivateJwk ? "[redacted]" : null },
    exportSigningKey: usePersistedStore.getState().exportSigningKey ? "[redacted]" : null,
  }), [auditEvents, contactsCount, deviceDiagnostics, lastProcessedTick, latestStats?.activeAddresses, latestStats?.price, pendingRequestCount, pendingTxCount, recentIssues, settings, tickInfo?.epoch, tickInfo?.tick, totalAccounts, updater, vaultsCount]);

  async function exportBundle() {
    await saveFileDialog(`glyph-debug-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2));
  }

  return { exportBundle };
}
