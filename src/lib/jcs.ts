export const REQUEST_PROTOCOL_V2 = "glyph-connect-request/2";
export const CALLBACK_ENVELOPE_VERSION_V2 = "glyph-connect-callback-envelope/2";

export function jcsCanonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS cannot encode non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jcsCanonicalize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${jcsCanonicalize(record[key])}`).join(",")}}`;
  }
  throw new Error(`JCS cannot encode ${typeof value}`);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function jcsSha256Base64Url(value: unknown): Promise<string> {
  return sha256Base64Url(jcsCanonicalize(value));
}

export type GlyphNetworkBinding = { id: "qubic:mainnet" | "qubic:testnet" | `qubic:custom:sha256:${string}` };

export async function requestHashV2(input: {
  protocol: typeof REQUEST_PROTOCOL_V2;
  request: unknown;
  callback: string | null;
  redirect_uri: string | null;
  network: GlyphNetworkBinding;
}): Promise<string> {
  return `sha256:${await jcsSha256Base64Url(input)}`;
}
