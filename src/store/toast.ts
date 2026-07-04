import { useSyncExternalStore } from "react";

export type ToastKind = "received" | "sent" | "confirmed" | "failed" | "expired" | "deep_link" | "price_alert";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body: string;
  /** Auto-dismiss duration in ms. 0 = sticky. */
  duration: number;
  createdAt: number;
}

// ── External store ────────────────────────────────────────────────────────────

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Toast[] {
  return toasts;
}

// ── Actions ───────────────────────────────────────────────────────────────────

let nextId = 0;

export function addToast(input: {
  kind: ToastKind;
  title: string;
  body: string;
  duration?: number;
}): string {
  const id = `toast-${++nextId}-${Date.now()}`;
  const toast: Toast = {
    id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    duration: input.duration ?? 5000,
    createdAt: Date.now(),
  };
  toasts = [...toasts, toast];
  emit();
  return id;
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
