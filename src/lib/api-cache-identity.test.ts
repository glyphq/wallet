import { describe, expect, test } from "bun:test";
import { DEFAULT_API_URL } from "@/lib/api-url";
import { apiCacheIdentity } from "@/lib/api-cache-identity";

describe("apiCacheIdentity", () => {
  test("normalizes the API origin", () => {
    expect(apiCacheIdentity({ apiUrl: "https://api.example/" })).toBe("api:https://api.example");
    expect(apiCacheIdentity({ apiUrl: "https://api.example/v1/" })).toBe("api:https://api.example");
  });

  test("falls back to the bundled mainnet API for invalid URLs", () => {
    expect(apiCacheIdentity({ apiUrl: "http://insecure" })).toBe(`api:${DEFAULT_API_URL}`);
  });
});
