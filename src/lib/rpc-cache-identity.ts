import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL, normalizeRpcUrl } from "@/lib/rpc";

export type RpcCacheScope = "live" | "archive" | "both";

export function rpcCacheIdentity(
  network: { liveApiUrl: string; queryApiUrl: string },
  scope: RpcCacheScope = "both",
): string {
  const live = normalizeRpcUrl(network.liveApiUrl) ?? DEFAULT_LIVE_URL;
  const archive = normalizeRpcUrl(network.queryApiUrl) ?? DEFAULT_ARCHIVE_URL;

  if (scope === "live") return `live:${live}`;
  if (scope === "archive") return `archive:${archive}`;
  return `live:${live}|archive:${archive}`;
}
