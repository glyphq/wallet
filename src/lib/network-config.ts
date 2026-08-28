import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL } from "@/lib/rpc";

export type NetworkKind = "mainnet" | "testnet" | "custom";
export type NetworkScope = `qubic:${string}`;

export interface NetworkConfig {
  /** Display classification. Always derived from the canonical endpoint pair. */
  name: NetworkKind;
  liveApiUrl: string;
  queryApiUrl: string;
  /** Stable identity used to partition chain-derived state and RPC caches. */
  scope: NetworkScope;
  /**
   * Local-node manifest identity. A node wipe must produce a new value so its
   * chain-derived state receives a new scope even when the endpoints stay put.
   */
  manifestInstanceId: string | null;
}

export interface NetworkConfigInput {
  liveApiUrl: unknown;
  queryApiUrl: unknown;
  manifestInstanceId?: unknown;
}

export const MAINNET_NETWORK_SCOPE = "qubic:mainnet" as const;
export const LOCAL_TESTNET_LIVE_API_URL =
  "http://127.0.0.1:41841/live/v1";
export const LOCAL_TESTNET_QUERY_API_URL =
  "http://127.0.0.1:41841/query/v1";
export const LOCAL_TESTNET_UNRESOLVED_INSTANCE = "manifest-unresolved";
export const LOCAL_TESTNET_NETWORK_SCOPE_PREFIX = "qubic:testnet:local:" as const;

const LOCAL_MANIFEST_INSTANCE_ID_PATTERN = /^qubic-local:[0-9a-f]{64}$/u;

export class InvalidNetworkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNetworkConfigError";
  }
}

function isAllowedRpcProtocol(url: URL): boolean {
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  const normalized = url.toString().replace(/\/+$/, "");
  return (
    normalized === LOCAL_TESTNET_LIVE_API_URL ||
    normalized === LOCAL_TESTNET_QUERY_API_URL
  );
}

/**
 * Canonicalizes an RPC base URL without falling back to another network.
 * HTTPS is accepted generally. Plain HTTP is restricted to the two exact
 * bundled local testnet bases supported by the native transport.
 */
export function normalizeNetworkRpcUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!isAllowedRpcProtocol(parsed)) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function normalizeManifestInstanceId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidNetworkConfigError("Network manifest instanceId must be a string");
  }
  if (!LOCAL_MANIFEST_INSTANCE_ID_PATTERN.test(value)) {
    throw new InvalidNetworkConfigError("Network manifest instanceId is invalid");
  }
  return value;
}

export function identifyNetworkKind(
  liveApiUrl: string,
  queryApiUrl: string
): NetworkKind {
  if (liveApiUrl === DEFAULT_LIVE_URL && queryApiUrl === DEFAULT_ARCHIVE_URL) {
    return "mainnet";
  }
  if (
    liveApiUrl === LOCAL_TESTNET_LIVE_API_URL &&
    queryApiUrl === LOCAL_TESTNET_QUERY_API_URL
  ) {
    return "testnet";
  }
  return "custom";
}

function customNetworkScope(liveApiUrl: string, queryApiUrl: string): NetworkScope {
  return `qubic:custom:${encodeURIComponent(liveApiUrl)}|${encodeURIComponent(queryApiUrl)}`;
}

export function localTestnetNetworkScope(
  manifestInstanceId: string | null
): NetworkScope {
  const normalizedInstanceId = normalizeManifestInstanceId(manifestInstanceId);
  return `${LOCAL_TESTNET_NETWORK_SCOPE_PREFIX}${encodeURIComponent(
    normalizedInstanceId ?? LOCAL_TESTNET_UNRESOLVED_INSTANCE
  )}`;
}

/**
 * Resolves an endpoint pair into the sole canonical persisted configuration.
 * The display name and scope are outputs, not caller-controlled inputs.
 */
export function resolveNetworkConfig(input: NetworkConfigInput): NetworkConfig {
  const liveApiUrl = normalizeNetworkRpcUrl(input.liveApiUrl);
  const queryApiUrl = normalizeNetworkRpcUrl(input.queryApiUrl);
  if (!liveApiUrl || !queryApiUrl) {
    throw new InvalidNetworkConfigError("Both network RPC endpoints must be valid URLs");
  }

  const name = identifyNetworkKind(liveApiUrl, queryApiUrl);
  const manifestInstanceId = normalizeManifestInstanceId(input.manifestInstanceId);
  if (name !== "testnet" && manifestInstanceId !== null) {
    throw new InvalidNetworkConfigError(
      "manifestInstanceId is only valid for the bundled local testnet"
    );
  }

  const scope =
    name === "mainnet"
      ? MAINNET_NETWORK_SCOPE
      : name === "testnet"
        ? localTestnetNetworkScope(manifestInstanceId)
        : customNetworkScope(liveApiUrl, queryApiUrl);

  return { name, liveApiUrl, queryApiUrl, scope, manifestInstanceId };
}

export function tryResolveNetworkConfig(
  input: NetworkConfigInput
): NetworkConfig | null {
  try {
    return resolveNetworkConfig(input);
  } catch {
    return null;
  }
}

/** Strict parser for current-version persisted data. */
export function parsePersistedNetworkConfig(value: unknown): NetworkConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidNetworkConfigError("Persisted network configuration is missing");
  }
  const candidate = value as Record<string, unknown>;
  const resolved = resolveNetworkConfig({
    liveApiUrl: candidate.liveApiUrl,
    queryApiUrl: candidate.queryApiUrl,
    manifestInstanceId: candidate.manifestInstanceId,
  });
  if (candidate.name !== resolved.name || candidate.scope !== resolved.scope) {
    throw new InvalidNetworkConfigError(
      "Persisted network name or scope does not match its endpoints"
    );
  }
  return resolved;
}

export function isNetworkScope(value: unknown): value is NetworkScope {
  return (
    value === MAINNET_NETWORK_SCOPE ||
    (typeof value === "string" &&
      ((value.startsWith(LOCAL_TESTNET_NETWORK_SCOPE_PREFIX) &&
        value.length > LOCAL_TESTNET_NETWORK_SCOPE_PREFIX.length) ||
        (value.startsWith("qubic:custom:") && value.includes("|"))))
  );
}

export const MAINNET_NETWORK_CONFIG: NetworkConfig = resolveNetworkConfig({
  liveApiUrl: DEFAULT_LIVE_URL,
  queryApiUrl: DEFAULT_ARCHIVE_URL,
});

export const LOCAL_TESTNET_NETWORK_CONFIG: NetworkConfig = resolveNetworkConfig({
  liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
  queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
});
