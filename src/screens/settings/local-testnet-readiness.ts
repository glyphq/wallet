import {
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_QUERY_API_URL,
  resolveNetworkConfig,
  type NetworkConfig,
} from "@/lib/network-config";
import { LOCAL_NETWORK_MANIFEST_URL, type LocalNetworkManifest } from "@/lib/rpc-transport";

export type ReadinessCapability = "manifest" | "live" | "query" | "progress";
export type ReadinessPhase = "idle" | "checking" | "ready" | "error";

export interface LocalReadinessState {
  phase: ReadinessPhase;
  completed: readonly ReadinessCapability[];
  initialLiveTick: number | null;
  liveTick: number | null;
  queryTick: number | null;
  instanceId: string | null;
  error: string;
}

export type LocalReadinessEvent =
  | { type: "reset" }
  | { type: "start" }
  | { type: "capability"; capability: ReadinessCapability; tick?: number; instanceId?: string }
  | { type: "ready" }
  | { type: "error"; message: string };

export const INITIAL_LOCAL_READINESS_STATE: LocalReadinessState = {
  phase: "idle",
  completed: [],
  initialLiveTick: null,
  liveTick: null,
  queryTick: null,
  instanceId: null,
  error: "",
};

export function reduceLocalReadinessState(
  state: LocalReadinessState,
  event: LocalReadinessEvent,
): LocalReadinessState {
  if (event.type === "reset") return INITIAL_LOCAL_READINESS_STATE;
  if (event.type === "start") {
    return { ...INITIAL_LOCAL_READINESS_STATE, phase: "checking" };
  }
  if (event.type === "error") {
    return { ...state, phase: "error", error: event.message };
  }
  if (event.type === "ready") {
    const required: readonly ReadinessCapability[] = ["manifest", "live", "query", "progress"];
    if (!required.every((capability) => state.completed.includes(capability))) return state;
    return { ...state, phase: "ready", error: "" };
  }

  const completed = state.completed.includes(event.capability)
    ? state.completed
    : [...state.completed, event.capability];
  if (event.capability === "manifest") {
    return { ...state, completed, instanceId: event.instanceId ?? null };
  }
  if (event.capability === "live") {
    return { ...state, completed, initialLiveTick: event.tick ?? null, liveTick: event.tick ?? null };
  }
  if (event.capability === "query") {
    return { ...state, completed, queryTick: event.tick ?? null };
  }
  return { ...state, completed, liveTick: event.tick ?? state.liveTick };
}

interface StrictLocalManifest extends LocalNetworkManifest {
  schemaVersion: 1;
  kind: "qubic-local-network";
  network: "qubic:local";
  name: "Qubic Local Testnet";
  manifestUrl: typeof LOCAL_NETWORK_MANIFEST_URL;
  endpoints: {
    live: typeof LOCAL_TESTNET_LIVE_API_URL;
    query: typeof LOCAL_TESTNET_QUERY_API_URL;
  };
}

function requireExactField(
  record: Record<string, unknown>,
  field: string,
  expected: string | number,
): void {
  if (record[field] !== expected) {
    throw new Error(`Local manifest ${field} does not match the supported dev-kit contract.`);
  }
}

/** Strictly validates the dev-kit identity and its immutable canonical endpoint contract. */
export function validateLocalNetworkManifest(manifest: LocalNetworkManifest): {
  manifest: StrictLocalManifest;
  config: NetworkConfig;
} {
  const record = manifest as Record<string, unknown>;
  requireExactField(record, "schemaVersion", 1);
  requireExactField(record, "kind", "qubic-local-network");
  requireExactField(record, "network", "qubic:local");
  requireExactField(record, "name", "Qubic Local Testnet");
  requireExactField(record, "manifestUrl", LOCAL_NETWORK_MANIFEST_URL);

  const endpoints = record.endpoints;
  if (!endpoints || typeof endpoints !== "object" || Array.isArray(endpoints)) {
    throw new Error("Local manifest endpoints are missing.");
  }
  const endpointRecord = endpoints as Record<string, unknown>;
  requireExactField(endpointRecord, "live", LOCAL_TESTNET_LIVE_API_URL);
  requireExactField(endpointRecord, "query", LOCAL_TESTNET_QUERY_API_URL);

  const config = resolveNetworkConfig({
    liveApiUrl: endpointRecord.live,
    queryApiUrl: endpointRecord.query,
    manifestInstanceId: manifest.instanceId,
  });
  if (config.name !== "testnet" || config.manifestInstanceId !== manifest.instanceId) {
    throw new Error("Local manifest identity does not match the canonical local configuration.");
  }

  return { manifest: manifest as StrictLocalManifest, config };
}

function requireTick(value: unknown, source: "live" | "query"): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`The local ${source} endpoint returned an invalid tick.`);
  }
  return value as number;
}

export interface LocalReadinessRpc {
  readLiveTick(signal: AbortSignal): Promise<unknown>;
  readQueryTick(signal: AbortSignal): Promise<unknown>;
}

export interface LocalReadinessOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
  onCapability?: (capability: ReadinessCapability, tick?: number) => void;
}

function defaultSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
    }, { once: true });
  });
}

/** Probes both RPC families and proves that the live tick advances before a fixed deadline. */
export async function verifyLocalNetworkReadiness(
  rpc: LocalReadinessRpc,
  options: LocalReadinessOptions = {},
): Promise<{ initialLiveTick: number; liveTick: number; queryTick: number }> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Local testnet readiness timed out.")), timeoutMs);
  const onExternalAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const deadline = now() + timeoutMs;
    const initialLiveTick = requireTick(await rpc.readLiveTick(controller.signal), "live");
    options.onCapability?.("live", initialLiveTick);
    let queryTick = requireTick(await rpc.readQueryTick(controller.signal), "query");
    options.onCapability?.("query", queryTick);

    while (now() < deadline) {
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - now())), controller.signal);
      const liveTick = requireTick(await rpc.readLiveTick(controller.signal), "live");
      if (liveTick < initialLiveTick) {
        throw new Error(`Local live tick moved backwards (${initialLiveTick} → ${liveTick}).`);
      }
      if (liveTick > initialLiveTick) {
        const latestQueryTick = requireTick(await rpc.readQueryTick(controller.signal), "query");
        if (latestQueryTick < queryTick) {
          throw new Error(`Local query tick moved backwards (${queryTick} → ${latestQueryTick}).`);
        }
        queryTick = latestQueryTick;
        options.onCapability?.("progress", liveTick);
        return { initialLiveTick, liveTick, queryTick };
      }
    }
    throw new Error(`Local live tick did not advance within ${Math.ceil(timeoutMs / 1000)} seconds.`);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
