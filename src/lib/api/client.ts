import { client } from "./generated/client.gen";
import { DEFAULT_API_URL, normalizeApiUrl } from "@/lib/api-url";

export { DEFAULT_API_URL, normalizeApiUrl };

let baseUrl = DEFAULT_API_URL;

/** Points every generated SDK call at the given Glyph API origin. Invalid URLs fall back to mainnet. */
export function configureApiClient(apiUrl: string): string {
  baseUrl = normalizeApiUrl(apiUrl) ?? DEFAULT_API_URL;
  client.setConfig({ baseUrl });
  return baseUrl;
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

configureApiClient(DEFAULT_API_URL);
