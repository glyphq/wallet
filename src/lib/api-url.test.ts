import { describe, expect, test } from "bun:test";
import { normalizeApiUrl } from "./api-url";

describe("normalizeApiUrl", () => {
  test("normalizes HTTPS origins and strips the generated-route prefix", () => {
    expect(normalizeApiUrl(" https://api.example/ ")).toBe("https://api.example");
    expect(normalizeApiUrl("https://api.example/v1/")).toBe("https://api.example");
  });

  test("rejects insecure remote origins and malformed input", () => {
    expect(normalizeApiUrl("http://api.example")).toBeNull();
    expect(normalizeApiUrl("not a url")).toBeNull();
    expect(normalizeApiUrl("")).toBeNull();
  });
});
