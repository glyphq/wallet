import {
  isPermissionGranted,
  requestPermission,
  sendNotification as tauriSend,
} from "@tauri-apps/plugin-notification";

export type NotificationPermissionResult =
  | { granted: true; state: "granted" }
  | { granted: false; state: "denied" | "unavailable" | "error"; message: string };

export type NotificationDeliveryResult =
  | { ok: true; state: "sent" }
  | { ok: false; state: "locked" | "denied" | "error"; message: string };

function notificationPlatform(): "macos" | "linux" | "other" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "other";
}

function permissionDeniedMessage(): string {
  switch (notificationPlatform()) {
    case "macos":
      return "Notifications are blocked for Glyph in macOS system settings.";
    case "linux":
      return "Desktop notifications are unavailable. On Linux this is often caused by an unpackaged app without a registered desktop entry.";
    default:
      return "Notifications are blocked in the OS settings.";
  }
}

function permissionErrorMessage(): string {
  switch (notificationPlatform()) {
    case "macos":
      return "Glyph could not verify macOS notification authorization.";
    case "linux":
      return "Glyph could not reach the Linux desktop notification service.";
    default:
      return "Glyph could not verify notification availability.";
  }
}

function deliveryErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  switch (notificationPlatform()) {
    case "macos":
      return detail
        ? `macOS rejected the notification delivery: ${detail}`
        : "macOS rejected the notification delivery.";
    case "linux":
      return detail
        ? `Linux notification delivery failed: ${detail}`
        : "Linux notification delivery failed. The desktop shell may be suppressing unpackaged apps.";
    default:
      return detail ? `Notification delivery failed: ${detail}` : "Notification delivery failed.";
  }
}

export function stripNotificationMarkup(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function notify(title: string, body: string): Promise<NotificationDeliveryResult> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const res = await requestPermission();
      granted = res === "granted";
    }
    if (!granted) {
      return { ok: false, state: "denied", message: permissionDeniedMessage() };
    }
    tauriSend({
      title: stripNotificationMarkup(title),
      body: stripNotificationMarkup(body),
      // Explicit icon name (bundle identifier) bypasses app-name-based icon lookup on
      // Linux, preventing a collision with any other app also named "Glyph" (e.g. the
      // ebook editor) that registers an icon under the same display name in the theme.
      icon: "com.qubic.glyph",
    });
    return { ok: true, state: "sent" };
  } catch (error) {
    return { ok: false, state: "error", message: deliveryErrorMessage(error) };
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  try {
    if (await isPermissionGranted()) return { granted: true, state: "granted" };
    const res = await requestPermission();
    if (res === "granted") return { granted: true, state: "granted" };
    return { granted: false, state: "denied", message: permissionDeniedMessage() };
  } catch {
    return { granted: false, state: "error", message: permissionErrorMessage() };
  }
}
