import { useUpdater } from "@/hooks/use-updater";
import { DiagnosticRow, DiagnosticSection } from "./diagnostic-primitives";
import { formatBytes } from "./format-bytes";
import type { DeviceDiagnostics } from "./use-device-diagnostics";

/** Version, update support, storage, and native device details. */
export function AppDeviceSection({
  updater,
  deviceDiagnostics,
  storageUsed,
  storageQuota,
}: {
  updater: ReturnType<typeof useUpdater>;
  deviceDiagnostics: DeviceDiagnostics | null;
  storageUsed: number | null;
  storageQuota: number | null;
}) {
  return (
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
  );
}
