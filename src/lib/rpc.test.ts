import { describe, expect, test } from "bun:test";
import {
  configureRpc,
  DEFAULT_ARCHIVE_URL,
  DEFAULT_LIVE_URL,
  LOCAL_CORE_LITE_ARCHIVE_URL,
  LOCAL_CORE_LITE_LIVE_URL,
  normalizeRpcUrl,
} from "./rpc";

describe("RPC endpoint configuration", () => {
  test("accepts HTTPS and only the exact local core-lite base URLs", () => {
    expect(normalizeRpcUrl("https://rpc.example/live/v1/")).toBe("https://rpc.example/live/v1");
    expect(normalizeRpcUrl(`${LOCAL_CORE_LITE_LIVE_URL}/`)).toBe(LOCAL_CORE_LITE_LIVE_URL);
    expect(normalizeRpcUrl(LOCAL_CORE_LITE_ARCHIVE_URL)).toBe(LOCAL_CORE_LITE_ARCHIVE_URL);

    for (const url of [
      "http://localhost:41841/live/v1",
      "http://127.0.0.1:41840/live/v1",
      "http://127.0.0.1:41841/",
      "http://127.0.0.1:41841/live/v2",
      "http://192.168.1.10:41841/live/v1",
      "ftp://127.0.0.1:41841/live/v1",
      "https://user:pass@rpc.example/live/v1",
      "https://rpc.example/live/v1?target=other",
      "https://rpc.example/live/v1#fragment",
      "not a url",
    ]) {
      expect(normalizeRpcUrl(url)).toBeNull();
    }
  });

  test("throws instead of silently replacing invalid endpoints with mainnet", () => {
    expect(() => configureRpc("http://192.168.1.10:41841/live/v1", LOCAL_CORE_LITE_ARCHIVE_URL)).toThrow(
      "Invalid RPC endpoint configuration",
    );

    // Restore the process-wide singleton for other tests importing this module.
    configureRpc(DEFAULT_LIVE_URL, DEFAULT_ARCHIVE_URL);
  });
});
