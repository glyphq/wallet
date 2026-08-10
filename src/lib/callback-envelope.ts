import type { GlyphCallbackResponse, GlyphEnvelope, GlyphRequest } from "@/lib/request-schema";
import { CALLBACK_ENVELOPE_VERSION_V2, bytesToBase64, jcsCanonicalize, sha256Base64Url } from "@/lib/jcs";

export const CALLBACK_ENVELOPE_VERSION = CALLBACK_ENVELOPE_VERSION_V2;
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
  request_hash: string;
  network: GlyphEnvelope["network"];
  nonce: string;
  dapp_origin: string;
  request_type: GlyphRequest["type"];
  exp: number | null;
  issued_at: number;
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
  return jcsCanonicalize(payload);
}

function safeEpochSeconds(epochSeconds: number): number {
  if (!Number.isSafeInteger(epochSeconds) || epochSeconds < 0) {
    throw new Error("callback issued_at must be a non-negative safe integer epoch seconds value");
  }
  return epochSeconds;
}

export async function buildCallbackSignaturePayload(envelope: GlyphEnvelope, result: GlyphCallbackResponse, issuedAtEpochSeconds: number): Promise<CallbackSignaturePayload> {
  const exp = envelope.request.exp ?? null;
  return {
    version: CALLBACK_ENVELOPE_VERSION,
    request_hash: envelope.request_hash,
    network: envelope.network,
    nonce: envelope.request.nonce,
    dapp_origin: envelope.request.dapp.origin,
    request_type: envelope.request.type,
    exp,
    issued_at: safeEpochSeconds(issuedAtEpochSeconds),
    result_hash: `sha256:${await sha256Base64Url(jcsCanonicalize(result))}`,
    relay: await buildRelayBinding(envelope.callback),
  };
}

export async function buildSignedCallbackEnvelope(input: {
  envelope: GlyphEnvelope;
  result: GlyphCallbackResponse;
  identity: string;
  accountIndex: number;
  signMessage: (accountIndex: number, messageBytes: Uint8Array) => Promise<{ signature: Uint8Array; publicKey: Uint8Array; identity: string }>;
  nowEpochSeconds?: () => number;
}): Promise<GlyphSignedCallbackEnvelope> {
  const payload = await buildCallbackSignaturePayload(input.envelope, input.result, input.nowEpochSeconds?.() ?? Math.floor(Date.now() / 1000));
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
