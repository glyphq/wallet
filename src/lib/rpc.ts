import { createQubicClient } from "@qubic.org/rpc";
import {
  LOCAL_CORE_LITE_ARCHIVE_URL,
  LOCAL_CORE_LITE_LIVE_URL,
  rpcFetch,
} from "./rpc-transport";
export { createQubicClient };
export { estimateTargetTick, pollUntilConfirmed, waitForTick } from "@qubic.org/rpc";
export type {
  QubicClient,
  LiveClient,
  QueryClient,
  Result,
} from "@qubic.org/rpc";

export const DEFAULT_LIVE_URL = "https://rpc.qubic.org/live/v1";
export const DEFAULT_ARCHIVE_URL = "https://rpc.qubic.org/query/v1";
export { LOCAL_CORE_LITE_ARCHIVE_URL, LOCAL_CORE_LITE_LIVE_URL } from "./rpc-transport";

export function normalizeRpcUrl(url: string): string | null {
  const trimmed = url.trim();
  if (
    trimmed === LOCAL_CORE_LITE_LIVE_URL ||
    trimmed === `${LOCAL_CORE_LITE_LIVE_URL}/` ||
    trimmed === LOCAL_CORE_LITE_ARCHIVE_URL ||
    trimmed === `${LOCAL_CORE_LITE_ARCHIVE_URL}/`
  ) {
    return trimmed.replace(/\/$/, "");
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

let _client = createQubicClient({
  liveBaseUrl: DEFAULT_LIVE_URL,
  archiveBaseUrl: DEFAULT_ARCHIVE_URL,
  fetch: rpcFetch,
});

/** Returns the singleton Qubic RPC client. Re-created by `configureRpc` when endpoints change. */
export function getRpcClient() {
  return _client;
}

export async function getLatestTick(): Promise<number> {
  const result = await _client.live.getTickInfo();
  if (!result.ok || result.value.tick === undefined || result.value.tick === null) {
    throw new Error("Failed to fetch current tick");
  }
  return result.value.tick;
}

/** Replaces the singleton RPC client with new endpoint URLs — call when the user changes the network in settings. */
export function configureRpc(liveBaseUrl: string, archiveBaseUrl: string) {
  const normalizedLive = normalizeRpcUrl(liveBaseUrl);
  const normalizedArchive = normalizeRpcUrl(archiveBaseUrl);
  if (!normalizedLive || !normalizedArchive) {
    throw new TypeError("Invalid RPC endpoint configuration");
  }

  _client = createQubicClient({
    liveBaseUrl: normalizedLive,
    archiveBaseUrl: normalizedArchive,
    fetch: rpcFetch,
  });
}
