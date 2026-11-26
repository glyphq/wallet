/**
 * Keep a deep-link request visible until its response has been assembled and
 * delivery has been attempted. If the action throws, the caller can show a
 * safe retry message while the original request remains pending.
 */
export async function completePendingRequest<T>(
  action: () => Promise<T>,
  removePending: () => void,
  beforeRemove?: (result: T) => void,
): Promise<T> {
  const result = await action();
  beforeRemove?.(result);
  removePending();
  return result;
}

