import { describe, expect, test } from "bun:test";
import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL } from "@/lib/rpc";
import { rpcCacheIdentity } from "@/lib/rpc-cache-identity";

describe("rpcCacheIdentity", () => {
  const network = {
    liveApiUrl: "https://live.example/v1/",
    queryApiUrl: "https://archive.example/query/",
  };

  test("normalizes endpoint URLs and scopes live/archive identities", () => {
    expect(rpcCacheIdentity(network, "live")).toBe("live:https://live.example/v1");
    expect(rpcCacheIdentity(network, "archive")).toBe("archive:https://archive.example/query");
    expect(rpcCacheIdentity(network, "both")).toBe(
      "live:https://live.example/v1|archive:https://archive.example/query",
    );
  });

  test("falls back to default endpoints for invalid URLs", () => {
    expect(rpcCacheIdentity({ liveApiUrl: "http://insecure", queryApiUrl: "not a url" })).toBe(
      `live:${DEFAULT_LIVE_URL}|archive:${DEFAULT_ARCHIVE_URL}`,
    );
  });
});
