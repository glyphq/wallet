import { useEffect, useState } from "react";
import {
  getBatteryInfo,
  getDeviceInfo,
  getDisplayInfo,
  getNetworkInfo,
  getStorageInfo,
} from "tauri-plugin-device-info-api";
import { formatBytes } from "./format-bytes";

export interface DeviceDiagnostics {
  device: string | null;
  battery: string | null;
  network: string | null;
  storage: string | null;
  display: string | null;
}

/** Collects app storage usage plus native device details for the diagnostics screen. */
export function useDeviceDiagnostics() {
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageQuota, setStorageQuota] = useState<number | null>(null);
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<DeviceDiagnostics | null>(null);

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

  return { storageUsed, storageQuota, deviceDiagnostics };
}
