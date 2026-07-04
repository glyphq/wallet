import { type NotificationDeliveryResult } from "@/lib/notifications";
import { addToast, type ToastKind } from "@/store/toast";
import { useSessionStore } from "@/store/session";
import { usePersistedStore, type NotificationEvent, type NotificationEventKind } from "@/store/persisted";

function makeEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createNotificationEvent(input: {
  kind: NotificationEventKind;
  title: string;
  body: string;
  identity?: string;
  txHash?: string;
  dedupeKey?: string;
  createdAt?: number;
}): NotificationEvent {
  return {
    id: makeEventId(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    createdAt: input.createdAt ?? Date.now(),
    readAt: null,
    identity: input.identity,
    txHash: input.txHash,
    dedupeKey: input.dedupeKey,
  };
}

export async function publishNotificationEvent(
  event: NotificationEvent,
  options?: { desktop?: boolean },
): Promise<NotificationDeliveryResult | null> {
  usePersistedStore.getState().addNotificationEvent(event);
  if (options?.desktop === false) {
    return null;
  }
  const { notificationsEnabled, notifyWhenLocked } = usePersistedStore.getState().settings;
  const isLocked = useSessionStore.getState().isLocked;
  if (!notificationsEnabled) {
    return null;
  }
  if (isLocked && !notifyWhenLocked) {
    return { ok: false, state: "locked", message: "Desktop notifications are suppressed while the vault is locked." };
  }
  addToast({
    kind: event.kind as ToastKind,
    title: event.title,
    body: event.body,
  });
  return { ok: true, state: "sent" };
}
