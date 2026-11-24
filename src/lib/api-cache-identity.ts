import { DEFAULT_API_URL, normalizeApiUrl } from "@/lib/api-url";

/** Stable cache scope for the active Glyph API origin. */
export function apiCacheIdentity(network: { apiUrl: string }): string {
  return `api:${normalizeApiUrl(network.apiUrl) ?? DEFAULT_API_URL}`;
}
