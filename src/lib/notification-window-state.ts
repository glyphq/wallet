interface NotificationIdentity {
  id: string;
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
