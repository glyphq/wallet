import { createTransactionLifecycleLink } from "@/lib/api/generated";
import { getApiBaseUrl } from "./client";
import type { LifecycleProgress } from "@/lib/tx-resolution";

export interface LifecycleStreamProgress extends LifecycleProgress {
  hash: string;
  targetTick: number | null;
  currentTick: number | null;
}

export interface LifecycleSubscriptionHandlers {
  onProgress?: (progress: LifecycleStreamProgress) => void;
  onTerminal?: (progress: LifecycleStreamProgress) => void;
}

const TERMINAL_STATES = new Set(["confirmed", "failed", "expired", "missed", "cancelled"]);
const LINK_RETRY_MS = 30_000;
const LINK_EXPIRED_RETRY_MS = 1_000;
const REQUEST_FAILED_RETRY_MS = 5_000;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Extracts the stream URL from the lifecycle-link response envelope. */
export function lifecycleLinkUrl(payload: unknown): string | null {
  const root = record(payload);
  const data = record(root?.data);
  const url = typeof data?.url === "string" ? data.url : typeof root?.url === "string" ? root.url : null;
  return url && url.trim() ? url.trim() : null;
}

/** Parses one lifecycle-stream `progress` frame. */
export function parseLifecycleProgress(raw: string): LifecycleStreamProgress | null {
  try {
    const value = record(JSON.parse(raw));
    if (!value || typeof value.hash !== "string" || typeof value.state !== "string") return null;
    return {
      hash: value.hash,
      state: value.state,
      moneyFlew: booleanOrNull(value.money_flew),
      includedTick: numberOrNull(value.included_tick),
      targetTick: numberOrNull(value.target_tick),
      currentTick: numberOrNull(value.current_tick),
    };
  } catch {
    return null;
  }
}

function parseDoneProgress(raw: string, previous: LifecycleStreamProgress | null): LifecycleStreamProgress | null {
  try {
    const value = record(JSON.parse(raw));
    if (!value || typeof value.hash !== "string" || typeof value.state !== "string") return null;
    return {
      hash: value.hash,
      state: value.state,
      moneyFlew: previous?.moneyFlew ?? booleanOrNull(value.money_flew),
      includedTick: previous?.includedTick ?? numberOrNull(value.included_tick),
      targetTick: previous?.targetTick ?? numberOrNull(value.target_tick),
      currentTick: previous?.currentTick ?? numberOrNull(value.current_tick),
    };
  } catch {
    return null;
  }
}

/**
 * Opens a short-lived lifecycle SSE link for one transaction. The link is
 * renewed after expiry or a closed connection; callers keep their polling
 * fallback for unsupported or unavailable streams.
 */
export function subscribeTransactionLifecycle(
  hash: string,
  handlers: LifecycleSubscriptionHandlers,
): () => void {
  if (typeof EventSource === "undefined") return () => {};

  let closed = false;
  let terminal = false;
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastProgress: LifecycleStreamProgress | null = null;

  const closeSource = () => {
    source?.close();
    source = null;
  };

  const stop = () => {
    closed = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    closeSource();
  };

  const finish = (progress: LifecycleStreamProgress) => {
    if (terminal) return;
    terminal = true;
    closeSource();
    handlers.onTerminal?.(progress);
  };

  const schedule = (delay: number) => {
    if (closed || terminal) return;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void open();
    }, delay);
  };

  const open = async () => {
    if (closed || terminal) return;
    try {
      const response = await createTransactionLifecycleLink({
        path: { hash },
        query: { ttl_seconds: 900 },
        throwOnError: true,
      });
      if (closed || terminal) return;
      const link = lifecycleLinkUrl(response.data);
      if (!link) throw new Error("lifecycle link response did not include a URL");
      const url = new URL(link, getApiBaseUrl());
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("lifecycle link did not use HTTP");
      }

      source = new EventSource(url.toString());
      source.addEventListener("progress", (event) => {
        const progress = parseLifecycleProgress((event as MessageEvent<string>).data);
        if (!progress) return;
        lastProgress = progress;
        handlers.onProgress?.(progress);
        if (TERMINAL_STATES.has(progress.state)) finish(progress);
      });
      source.addEventListener("done", (event) => {
        const progress = parseDoneProgress((event as MessageEvent<string>).data, lastProgress);
        if (progress) finish(progress);
      });
      source.addEventListener("link_expired", () => {
        closeSource();
        schedule(LINK_EXPIRED_RETRY_MS);
      });
      source.addEventListener("error", () => {
        if (source?.readyState !== EventSource.CLOSED) return;
        closeSource();
        schedule(REQUEST_FAILED_RETRY_MS);
      });
    } catch {
      schedule(LINK_RETRY_MS);
    }
  };

  void open();
  return stop;
}
