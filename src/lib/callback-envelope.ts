import type { GlyphCallbackResponse, GlyphEnvelope, GlyphRequest } from "@/lib/request-schema";

export const CALLBACK_ENVELOPE_VERSION = "glyph-connect-callback-envelope/1";
export const CALLBACK_SIGNATURE_ALGORITHM = "qubic-schnorrq-sha256";

export interface CallbackRelayBinding {
  callback_url: string | null;
  official_relay: boolean;
  route: "v1_callback" | "v2_session_callback" | "unknown" | null;
  v1_nonce: string | null;
  session_id: string | null;
  callback_capability_fingerprint: string | null;
}

export interface CallbackSignaturePayload {
  version: typeof CALLBACK_ENVELOPE_VERSION;
  nonce: string;
  dapp_origin: string;
  request_type: GlyphRequest["type"];
  exp: number | null;
  result_hash: string;
  relay: CallbackRelayBinding;
}

export interface GlyphSignedCallbackEnvelope {
  version: typeof CALLBACK_ENVELOPE_VERSION;
  result: GlyphCallbackResponse;
  payload: CallbackSignaturePayload;
  proof: {
    algorithm: typeof CALLBACK_SIGNATURE_ALGORITHM;
    identity: string;
    public_key: string;
    signature: string;
    signed_payload: string;
  };
}

const OFFICIAL_RELAY_ORIGIN = "https://relay.glyphq.org";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
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

export async function buildRelayBinding(callbackUrl: string | null): Promise<CallbackRelayBinding> {
  const fallback: CallbackRelayBinding = {
    callback_url: callbackUrl,
    official_relay: false,
    route: callbackUrl ? "unknown" : null,
    v1_nonce: null,
    session_id: null,
    callback_capability_fingerprint: null,
  };
  if (!callbackUrl) return fallback;

  try {
    const url = new URL(callbackUrl);
    if (url.origin !== OFFICIAL_RELAY_ORIGIN || url.search || url.hash) return fallback;

    const v1Nonce = url.pathname.match(/^\/v1\/callback\/([A-Za-z0-9_-]{16,128})$/)?.[1] ?? null;
    if (v1Nonce) return { ...fallback, official_relay: true, route: "v1_callback", v1_nonce: v1Nonce };

    const v2 = url.pathname.match(/^\/v2\/callback\/([A-Za-z0-9_-]{16,128})\/([A-Za-z0-9_-]{16,256})$/);
    if (v2) {
      const callbackCapabilityFingerprint = await sha256Base64Url(v2[2]);
      return {
        ...fallback,
        callback_url: `${url.origin}/v2/callback/${v2[1]}/${callbackCapabilityFingerprint}`,
        official_relay: true,
        route: "v2_session_callback",
        session_id: v2[1],
        callback_capability_fingerprint: callbackCapabilityFingerprint,
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function canonicalCallbackPayload(payload: CallbackSignaturePayload): string {
  return canonicalize(payload);
}

export async function buildCallbackSignaturePayload(envelope: GlyphEnvelope, result: GlyphCallbackResponse): Promise<CallbackSignaturePayload> {
  return {
    version: CALLBACK_ENVELOPE_VERSION,
    nonce: envelope.request.nonce,
    dapp_origin: envelope.request.dapp.origin,
    request_type: envelope.request.type,
    exp: envelope.request.exp ?? null,
    result_hash: await sha256Base64Url(canonicalize(result)),
    relay: await buildRelayBinding(envelope.callback),
  };
}

export async function buildSignedCallbackEnvelope(input: {
  envelope: GlyphEnvelope;
  result: GlyphCallbackResponse;
  identity: string;
  accountIndex: number;
  signMessage: (accountIndex: number, messageBytes: Uint8Array) => Promise<{ signature: Uint8Array; publicKey: Uint8Array; identity: string }>;
}): Promise<GlyphSignedCallbackEnvelope> {
  const payload = await buildCallbackSignaturePayload(input.envelope, input.result);
  const signedPayload = canonicalCallbackPayload(payload);
  const signed = await input.signMessage(input.accountIndex, new TextEncoder().encode(signedPayload));
  return {
    version: CALLBACK_ENVELOPE_VERSION,
    result: input.result,
    payload,
    proof: {
      algorithm: CALLBACK_SIGNATURE_ALGORITHM,
      identity: signed.identity || input.identity,
      public_key: bytesToBase64(signed.publicKey),
      signature: bytesToBase64(signed.signature),
      signed_payload: signedPayload,
    },
  };
}
