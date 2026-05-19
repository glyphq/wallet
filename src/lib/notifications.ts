import {
  isPermissionGranted,
  requestPermission,
  sendNotification as tauriSend,
} from "@tauri-apps/plugin-notification";

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!(await isPermissionGranted())) return;
    tauriSend({ title, body });
  } catch {
    // non-critical
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    const res = await requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}
