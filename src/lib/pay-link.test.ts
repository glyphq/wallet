import { describe, expect, test } from "bun:test";
import { parsePayLink } from "@/lib/pay-link";

const identity = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("parsePayLink", () => {
  test("rejects malformed, invalid, and out-of-range native pay payloads", () => {
    for (const payload of [
      "not json",
      JSON.stringify({ to: "not-an-identity" }),
      JSON.stringify({ to: identity, amount: "-1" }),
      JSON.stringify({ to: identity, amount: "18446744073709551616" }),
      JSON.stringify({ to: identity, label: "x".repeat(257) }),
    ]) {
      expect(parsePayLink(payload)).toBeNull();
    }
  });
});
