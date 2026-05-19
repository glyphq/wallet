import {
  isPermissionGranted,
  requestPermission,
  sendNotification as tauriSend,
} from "@tauri-apps/plugin-notification";

let _permission: boolean | null = null;

async function getPermission(): Promise<boolean> {
  if (_permission !== null) return _permission;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const res = await requestPermission();
      granted = res === "granted";
    }
    _permission = granted;
    return granted;
  } catch {
    _permission = false;
    return false;
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!(await getPermission())) return;
    tauriSend({ title, body });
  } catch {
    // non-critical — swallow
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  _permission = null; // force re-check
  return getPermission();
}
