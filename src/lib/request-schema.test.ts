import { describe, expect, test } from "bun:test";
import { buildRequestNotification, parseGlyphEnvelope } from "@/lib/request-schema";

describe("parseGlyphEnvelope", () => {
  test("accepts https origins and localhost callbacks", () => {
    const result = parseGlyphEnvelope(JSON.stringify({
      request: {
        type: "transfer",
        dapp: { name: "Demo", origin: "https://demo.app" },
        nonce: "n1",
        to: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        amount: "1000",
      },
      callback: "http://localhost:3000/callback",
    }));

    expect(result.error).toBeNull();
    expect(result.envelope?.request.type).toBe("transfer");
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
