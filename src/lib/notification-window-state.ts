interface NotificationIdentity {
  id: string;
  kind: string;
  txHash: string | null;
}

/**
 * Keeps one card per transaction hash. Lifecycle updates replace the existing
 * card in place so a transfer does not stack sent/confirmed/expired cards.
 */
export function upsertNotificationCard<T extends NotificationIdentity>(
  items: readonly T[],
  notification: T,
): T[] {
  const idIndex = items.findIndex((item) => item.id === notification.id);
  if (idIndex !== -1) {
    const next = [...items];
    next[idIndex] = notification;
    return next;
  }

  if (notification.txHash) {
    const txIndex = items.findIndex((item) => item.txHash === notification.txHash);
    if (txIndex !== -1) {
      const next = [...items];
      next[txIndex] = { ...notification, id: items[txIndex].id };
      return next;
    }
  }

  return [...items, notification];
}

/**
 * Enforces the visible-card limit without dropping an active sent transaction
 * that has not resolved yet.
 */
export function trimNotificationCards<T extends NotificationIdentity>(
  items: readonly T[],
  maxVisible: number,
): T[] {
  const limit = Math.max(1, maxVisible);
  const active = items.filter((item) => item.kind === "sent" && item.txHash !== null);
  const inactive = items.filter((item) => item.kind !== "sent" || item.txHash === null);
  const keepInactive = Math.max(0, limit - active.length);
  const kept = new Set<T>([...active, ...inactive.slice(-keepInactive)]);
  return items.filter((item) => kept.has(item));
}
