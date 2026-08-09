import { describe, expect, test } from "bun:test";
import { buildRequestNotification, MAX_REQUEST_CHARS, parseGlyphEnvelope } from "@/lib/request-schema";

describe("parseGlyphEnvelope", () => {
  test("accepts HTTPS callbacks bound to the dApp origin", () => {
    const result = parseGlyphEnvelope(JSON.stringify({
      request: {
        type: "transfer",
        dapp: { name: "Demo", origin: "https://demo.app" },
        nonce: "n1",
        to: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        amount: "1000",
      },
      callback: "https://demo.app/callback",
    }));

    expect(result.error).toBeNull();
    expect(result.envelope?.request.type).toBe("transfer");
  });

  test("accepts the official relay callback with a bounded nonce", () => {
    const result = parseGlyphEnvelope(JSON.stringify({
      request: {
        type: "connect",
        dapp: { name: "Glyph Support", origin: "https://glyphq.org" },
        nonce: "n1",
      },
      callback: "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae",
    }));

    expect(result.error).toBeNull();
    expect(result.envelope?.request.type).toBe("connect");
  });

  test("rejects localhost and untrusted callback origins", () => {
    for (const callback of [
      "http://localhost:3000/callback",
      "https://localhost/callback",
      "https://127.0.0.1/callback",
      "https://attacker.example/callback",
      "https://relay.glyphq.org/v1/stream/3dd2842cbb7f42a79354df9ddf6542ae",
      "https://relay.glyphq.org/v1/callback/short",
      "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae?extra=1",
    ]) {
      const result = parseGlyphEnvelope(JSON.stringify({
        request: {
          type: "connect",
          dapp: { name: "Demo", origin: "https://demo.app" },
          nonce: "n1",
        },
        callback,
      }));
      expect(result.envelope).toBeNull();
    }
  });

  test("rejects insecure origins", () => {
    const result = parseGlyphEnvelope(JSON.stringify({
      request: {
        type: "connect",
        dapp: { name: "Demo", origin: "http://demo.app" },
        nonce: "n1",
      },
    }));

    expect(result.envelope).toBeNull();
    expect(result.error).toBe("dApp origin must be HTTPS");
  });

  test("rejects negative and fractional contract-call amounts", () => {
    for (const amount of ["-1", 1.5]) {
      const result = parseGlyphEnvelope(JSON.stringify({
        request: {
          type: "sc_call",
          dapp: { name: "Demo", origin: "https://demo.app" },
          nonce: "n1",
          contract_index: 1,
          input_type: 1,
          amount,
        },
      }));
      expect(result.envelope).toBeNull();
    }
  });

  test("rejects oversized, unsafe, and malformed binary request fields", () => {
    const base = {
      type: "sc_call",
      dapp: { name: "Demo", origin: "https://demo.app" },
      nonce: "n1",
      contract_index: 1,
      input_type: 1,
    };
    for (const request of [
      { ...base, amount: "18446744073709551616" },
      { ...base, tick_offset: -1 },
      { ...base, payload: "not base64!" },
      { ...base, payload: "A".repeat(87_384 + 1) },
    ]) {
      expect(parseGlyphEnvelope(JSON.stringify({ request })).envelope).toBeNull();
    }
    expect(parseGlyphEnvelope(" ".repeat(MAX_REQUEST_CHARS + 1))).toEqual({
      envelope: null,
      error: "Request is too large",
    });
  });
});

describe("buildRequestNotification", () => {
  test("uses shared labels for contract calls", () => {
    const notification = buildRequestNotification({
      type: "sc_call",
      dapp: { name: "Demo", origin: "https://demo.app" },
      nonce: "n1",
      contract_index: 9,
      input_type: 1,
      amount: "2500",
    });

    expect(notification?.title).toBe("Request Waiting For Review");
    expect(notification?.body.length).toBeGreaterThan(0);
  });
});
