import type { TxResolution } from "./tx-resolution";

type Listener = (resolution: TxResolution) => void;

const listeners = new Map<string, Set<Listener>>();
const lastResolution = new Map<string, TxResolution>();
const MAX_REMEMBERED = 100;

/** Publishes a terminal transaction resolution to in-flight send screens. */
export function emitTxResolution(resolution: TxResolution): void {
  lastResolution.delete(resolution.hash);
  lastResolution.set(resolution.hash, resolution);
  if (lastResolution.size > MAX_REMEMBERED) {
    const oldest = lastResolution.keys().next().value;
    if (oldest !== undefined) lastResolution.delete(oldest);
  }
  for (const listener of listeners.get(resolution.hash) ?? []) listener(resolution);
}

/** Subscribes to a specific hash; replays an already-received terminal result. */
export function subscribeTxResolution(hash: string, listener: Listener): () => void {
  let set = listeners.get(hash);
  if (!set) {
    set = new Set();
    listeners.set(hash, set);
  }
  set.add(listener);

  const existing = lastResolution.get(hash);
  if (existing) queueMicrotask(() => listener(existing));

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(hash);
  };
}
