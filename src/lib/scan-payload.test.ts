import { describe, expect, test } from "bun:test";
import { parseScannedSendPayload } from "@/lib/scan-payload";

const identity = "BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK";

describe("parseScannedSendPayload", () => {
  test("classifies a raw recipient identity", () => {
    expect(parseScannedSendPayload(identity.toLowerCase())).toEqual({
      kind: "identity",
      source: "identity",
      identity,
    });
  });

  test("accepts strict glyph and official web payment links", () => {
    expect(parseScannedSendPayload(`glyph://pay?to=${identity}&amount=42&label=Coffee+fund`)).toEqual({
      kind: "payment-link",
      source: "glyph-pay-link",
      to: identity,
      amount: "42",
      label: "Coffee fund",
    });

    expect(parseScannedSendPayload(`https://wallet.glyphq.org/pay?to=${identity}`)).toEqual({
      kind: "payment-link",
      source: "web-pay-link",
      to: identity,
      amount: null,
      label: null,
    });
  });

  test("routes native pay JSON through the hardened pay parser", () => {
    expect(parseScannedSendPayload(JSON.stringify({ to: identity, amount: "7", label: "Invoice" }))).toEqual({
      kind: "payment-link",
      source: "native-pay-json",
      to: identity,
      amount: "7",
      label: "Invoice",
    });
  });

  test("rejects links outside the allowed routes and query rules", () => {
    for (const payload of [
      `glyph://pay?to=${identity}&to=${identity}`,
      `glyph://pay?to=${identity}&extra=value`,
      `glyph://pay/path?to=${identity}`,
      `glyph://pay@evil.example/?to=${identity}`,
      `glyph://pay?to=${identity}#frag`,
      `glyph://pay?to=${identity}&amount=0`,
      `glyph://pay?to=${identity}&amount=9223372036854775808`,
      `https://wallet.glyphq.org/pay?to=${identity}&extra=value`,
      `https://wallet.glyphq.org/pay/${identity}`,
      `https://evil.example/pay?to=${identity}`,
      `glyph://pay?to=${identity}|https://evil.example`,
      "not a supported QR",
    ]) {
      expect(parseScannedSendPayload(payload)).toBeNull();
    }
  });
});
