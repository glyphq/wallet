/** Canonical Glyph API origin. All chain reads and broadcasts go through this service. */
export const DEFAULT_API_URL = "https://api.glyphq.org";

function isDevLoopback(url: URL): boolean {
  return (
    import.meta.env.DEV &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
  );
}

/**
 * Normalizes a Glyph API origin. Only HTTPS is accepted outside development;
 * development additionally allows loopback HTTP for a local service.
 * A trailing slash and a trailing `/v1` are removed because generated paths
 * are already absolute (`/v1/status`).
 */
export function normalizeApiUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && !isDevLoopback(parsed)) return null;
    const normalized = parsed.toString().replace(/\/$/, "").replace(/\/v1$/, "");
    return normalized || null;
  } catch {
    return null;
  }
}
