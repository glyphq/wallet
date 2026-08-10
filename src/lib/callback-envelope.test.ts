import { describe, expect, test } from "bun:test";
import { buildCallbackSignaturePayload, buildRelayBinding, buildSignedCallbackEnvelope, canonicalCallbackPayload } from "@/lib/callback-envelope";
import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";
import { REQUEST_PROTOCOL_V2 } from "@/lib/jcs";

const relayEnvelope: GlyphEnvelope = {
  protocol: REQUEST_PROTOCOL_V2,
  request: {
    type: "connect",
    dapp: { name: "Demo", origin: "https://demo.app" },
    nonce: "request-nonce",
    exp: 1_900_000_000,
    permissions: ["transfer", "sign_message"],
  },
  callback: "https://relay.glyphq.org/v2/callback/session_1234567890abcdef/callbackCapabilitySecret_1234567890abcdef",
  redirect_uri: null,
  network: { id: "qubic:mainnet" },
  request_hash: "sha256:requestHash_12345678901234567890123456789012",
};

const result: GlyphCallbackResponse = {
  status: "connected",
  type: "connect",
  nonce: "request-nonce",
  identity: "IDENTITY",
  permissions: ["transfer"],
};

describe("callback envelope", () => {
  test("binds request, origin, expiry, result hash, network, and v2 relay capability fields", async () => {
    const payload = await buildCallbackSignaturePayload(relayEnvelope, result);

    expect(payload).toMatchObject({
      version: "glyph-connect-callback-envelope/2",
      request_hash: relayEnvelope.request_hash,
      network: { id: "qubic:mainnet" },
      nonce: "request-nonce",
      dapp_origin: "https://demo.app",
      request_type: "connect",
      exp: 1_900_000_000,
      relay: {
        callback_url: "https://relay.glyphq.org/v2/callback/session_1234567890abcdef/I3hmpEKOFd_adnSpDzj6BYkCc7h9VKbNL4NLsgSShEs",
        official_relay: true,
        route: "v2_session_callback",
        v1_nonce: null,
        session_id: "session_1234567890abcdef",
        callback_capability_fingerprint: "I3hmpEKOFd_adnSpDzj6BYkCc7h9VKbNL4NLsgSShEs",
      },
    });
    expect(payload.result_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(canonicalCallbackPayload(payload)).not.toContain("callbackCapabilitySecret_1234567890abcdef");
  });

  test("keeps unknown relay routes generic while canonically binding callback URL", async () => {
    expect(await buildRelayBinding("https://relay.glyphq.org/v2/other/shape")).toEqual({
      callback_url: "https://relay.glyphq.org/v2/other/shape",
      official_relay: false,
      route: "unknown",
      v1_nonce: null,
      session_id: null,
      callback_capability_fingerprint: null,
    });
  });

  test("signs canonical payload with the native session account signer", async () => {
    let signedLength = 0;
    const signed = await buildSignedCallbackEnvelope({
      envelope: relayEnvelope,
      result,
      identity: "IDENTITY",
      accountIndex: 2,
      signMessage: async (accountIndex, messageBytes) => {
        signedLength = messageBytes.length;
        return { signature: new Uint8Array([accountIndex, 7]), publicKey: new Uint8Array([1, 2, 3, 4]), identity: "IDENTITY" };
      },
    });

    expect(signed.proof).toMatchObject({
      algorithm: "qubic-schnorrq-sha256",
      identity: "IDENTITY",
      public_key: "AQIDBA==",
      signed_payload: canonicalCallbackPayload(signed.payload),
    });
    expect(signedLength).toBeGreaterThan(128);
    expect(signed.proof.signature).toBe("Agc=");
    expect(signed.result).toEqual(result);
  });
});
