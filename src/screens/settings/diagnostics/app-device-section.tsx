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
  const updateValue = updater.checking
    ? "Checking"
    : updater.installing
      ? `Installing ${updater.progress}%`
      : updater.update
        ? `v${updater.update.version} available`
        : updater.upToDate
          ? "Up to date"
          : updater.context?.supportsAutoUpdate
            ? "Ready"
            : "Not available";

  return (
    <DiagnosticSection title="App">
      <DiagnosticRow label="Version" value={updater.appVersion || "Not available"} />
      <DiagnosticRow label="Platform" value={updater.context?.platform ?? "Not available"} />
      <DiagnosticRow label="Package" value={updater.context?.packageKind ?? "Not available"} />
      <DiagnosticRow label="Updates" value={updateValue} tone={updater.checkError ? "error" : updater.update ? "warning" : undefined} />
      {storageUsed != null && storageQuota != null ? (
        <DiagnosticRow label="App storage" value={`${formatBytes(storageUsed)} of ${formatBytes(storageQuota)}`} />
      ) : null}
      {deviceDiagnostics?.device ? <DiagnosticRow label="Device" value={deviceDiagnostics.device} /> : null}
    </DiagnosticSection>
  );
}
