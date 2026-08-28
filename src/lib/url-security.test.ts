import { describe, expect, test } from "bun:test";
import { isGlobalHttpsUrl } from "@/lib/url-security";

describe("isGlobalHttpsUrl", () => {
  test("accepts public HTTPS hosts", () => {
    expect(isGlobalHttpsUrl("https://example.com/feed")).toBe(true);
    expect(isGlobalHttpsUrl("https://8.8.8.8/feed")).toBe(true);
    expect(isGlobalHttpsUrl("https://[2001:4860:4860::8888]/feed")).toBe(true);
  });

  test("rejects schemes, credentials, and non-global literals matching Rust callback policy", () => {
    for (const url of [
      "http://example.com/feed",
      "https://user:pass@example.com/feed",
      "https://localhost/feed",
      "https://127.0.0.1/feed",
      "https://10.0.0.1/feed",
      "https://169.254.1.1/feed",
      "https://192.0.2.1/feed",
      "https://[::1]/feed",
      "https://[fc00::1]/feed",
      "https://[fe80::1]/feed",
      "https://[ff00::1]/feed",
      "https://[2001:db8::1]/feed",
      "https://[::ffff:127.0.0.1]/feed",
    ]) {
      expect(isGlobalHttpsUrl(url)).toBe(false);
    }
  });
});
