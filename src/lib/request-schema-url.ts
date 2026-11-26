import { isGlobalHttpsUrl } from "@/lib/url-security";

/** Callbacks and redirect URIs must be absolute HTTPS URLs. */
export function isAllowedCallbackUrl(value: string): boolean {
  return isGlobalHttpsUrl(value);
}
