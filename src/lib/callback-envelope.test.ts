import { describe, expect, test } from "bun:test";
import { buildCallbackSignaturePayload, buildRelayBinding, buildSignedCallbackEnvelope, CALLBACK_SIGNATURE_ALGORITHM } from "@/lib/callback-envelope";
import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";

const envelope: GlyphEnvelope = {
  request: {
    type: "sign_message",
    dapp: { name: "Demo", origin: "https://demo.app" },
    nonce: "request-nonce",
    message: "hello",
  },
  callback: "https://demo.app/callback",
  redirect_uri: null,
};

const result: GlyphCallbackResponse = {
  status: "signed",
  type: "sign_message",
  nonce: "request-nonce",
  identity: "IDENTITY",
  signature: "user-message-signature",
  public_key: "user-message-public-key",
};

describe("callback envelope", () => {
  test("binds the request and result without exposing an official relay capability", async () => {
    const payload = await buildCallbackSignaturePayload(envelope, result, 1_900_000_000);
    expect(payload).toMatchObject({
      version: "glyph-connect-callback-envelope/2",
      nonce: "request-nonce",
      dapp_origin: "https://demo.app",
      request_type: "sign_message",
      network: { id: "qubic:mainnet" },
      relay: { callback_url: "https://demo.app/callback", official_relay: false, route: "unknown" },
    });
    expect(payload.result_hash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);
  });

  test("normalizes official relay capability material before signing", async () => {
    const binding = await buildRelayBinding("https://relay.glyphq.org/v2/callback/session_1234567890abcdef/capability_1234567890abcdef");
    expect(binding.official_relay).toBe(true);
    expect(binding.route).toBe("v2_session_callback");
    expect(binding.callback_url).not.toContain("capability_1234567890abcdef");
    expect(binding.callback_capability_fingerprint).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("uses the dedicated callback signer for a different payload", async () => {
    let signedPayload = "";
    const callback = await buildSignedCallbackEnvelope({
      envelope,
      result,
      identity: "IDENTITY",
      accountIndex: 3,
      signCallbackMessage: async (accountIndex, bytes) => {
        signedPayload = new TextDecoder().decode(bytes);
        return {
          signature: new Uint8Array([accountIndex, 7]),
          publicKey: new Uint8Array([1, 2, 3, 4]),
          identity: "IDENTITY",
        };
      },
      nowEpochSeconds: () => 1_900_000_000,
    });

    expect(callback.proof.algorithm).toBe(CALLBACK_SIGNATURE_ALGORITHM);
    expect(callback.proof.signed_payload).toBe(signedPayload);
    expect(callback.proof.signature).not.toBe(result.signature);
    expect(callback.result).toEqual(result);
  });
});

