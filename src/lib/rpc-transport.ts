import { invoke } from "@tauri-apps/api/core";
import { normalizeCoreLiteRpcBody } from "./core-lite-rpc-compat";

export const LOCAL_CORE_LITE_ORIGIN = "http://127.0.0.1:41841";
export const LOCAL_CORE_LITE_LIVE_URL = `${LOCAL_CORE_LITE_ORIGIN}/live/v1`;
export const LOCAL_CORE_LITE_ARCHIVE_URL = `${LOCAL_CORE_LITE_ORIGIN}/query/v1`;
export const LOCAL_NETWORK_MANIFEST_URL = "http://127.0.0.1:41842/network-manifest.json";
const LOCAL_NETWORK_INSTANCE_ID_PATTERN = /^qubic-local:[0-9a-f]{64}$/u;

interface NativeRpcResponse {
  status: number;
  body: string;
  contentType: string | null;
}

type NativeInvoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;
type GlobalFetch = (input: Request) => Promise<Response>;

export interface RpcFetchDependencies {
  nativeInvoke?: NativeInvoke;
  globalFetch?: GlobalFetch;
}

export interface LocalNetworkManifest {
  instanceId: string;
  [key: string]: unknown;
}

export interface LocalNetworkManifestOptions {
  signal?: AbortSignal;
  nativeInvoke?: NativeInvoke;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export function isLocalCoreLiteRequestUrl(url: URL): boolean {
  return url.protocol === "http:" && url.origin === LOCAL_CORE_LITE_ORIGIN;
}

/**
 * Fetch adapter for @qubic.org/rpc. HTTPS remains a regular webview fetch.
 * Only core-lite's exact numeric loopback origin crosses the Tauri IPC bridge;
 * the Rust command performs the authoritative method/path SSRF validation.
 */
export function createRpcFetch(dependencies: RpcFetchDependencies = {}): (input: Request) => Promise<Response> {
  const nativeInvoke = dependencies.nativeInvoke ?? invoke;
  const globalFetch = dependencies.globalFetch ?? ((input: Request) => globalThis.fetch(input));

  return async (input: Request): Promise<Response> => {
    const url = new URL(input.url);

    if (url.protocol === "https:") {
      return globalFetch(input);
    }

    if (!isLocalCoreLiteRequestUrl(url)) {
      throw new TypeError("RPC endpoints must use HTTPS or the approved local core-lite origin");
    }

    if (input.signal.aborted) throw abortError();
    const body = input.method === "GET" || input.method === "HEAD" ? null : await input.text();
    const responsePromise = nativeInvoke<NativeRpcResponse>("local_rpc_request", {
      url: input.url,
      method: input.method,
      body,
    });
    const nativeResponse = await withAbort(responsePromise, input.signal);
    const responseBody =
      nativeResponse.status >= 200 && nativeResponse.status < 300
        ? normalizeCoreLiteRpcBody(url.pathname, nativeResponse.body)
        : nativeResponse.body;
    const headers = new Headers();
    if (nativeResponse.contentType) headers.set("content-type", nativeResponse.contentType);

    return new Response(responseBody, {
      status: nativeResponse.status,
      headers,
    });
  };
}

export const rpcFetch = createRpcFetch();

/** Fetches the dev-kit's wipe-sensitive identity from its one exact native URL. */
export async function fetchLocalNetworkManifest(
  options: LocalNetworkManifestOptions = {},
): Promise<LocalNetworkManifest> {
  const nativeInvoke = options.nativeInvoke ?? invoke;
  const signal = options.signal ?? new AbortController().signal;
  const nativeResponse = await withAbort(
    nativeInvoke<NativeRpcResponse>("fetch_local_network_manifest", {}),
    signal,
  );
  if (nativeResponse.status < 200 || nativeResponse.status >= 300) {
    throw new Error(`Local network manifest returned HTTP ${nativeResponse.status}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(nativeResponse.body);
  } catch {
    throw new Error("Local network manifest was not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Local network manifest is missing instanceId");
  }
  const instanceId = (parsed as Record<string, unknown>).instanceId;
  if (typeof instanceId !== "string" || !LOCAL_NETWORK_INSTANCE_ID_PATTERN.test(instanceId)) {
    throw new Error("Local network manifest is missing instanceId");
  }
  return parsed as LocalNetworkManifest;
}
