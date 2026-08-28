import { describe, expect, test } from "bun:test";
import { qk } from "@/lib/query-keys";

describe("network-scoped query keys", () => {
  const first = "qubic:testnet:local:first|archive:http://127.0.0.1/query";
  const second = "qubic:testnet:local:second|archive:http://127.0.0.1/query";

  test("partitions each RPC-backed key by immutable network identity", () => {
    expect(qk.tickInfo(first)).not.toEqual(qk.tickInfo(second));
    expect(qk.lastProcessedTick(first)).not.toEqual(qk.lastProcessedTick(second));
    expect(qk.vaultBalances(first, ["A"])).not.toEqual(qk.vaultBalances(second, ["A"]));
    expect(qk.txHistory(first, "A")).not.toEqual(qk.txHistory(second, "A"));
    expect(qk.vaultAnalytics(first, "vault", ["A"])).not.toEqual(qk.vaultAnalytics(second, "vault", ["A"]));
    expect(qk.searchHistory(first, "A")).not.toEqual(qk.searchHistory(second, "A"));
  });

  test("keeps non-network query dimensions intact", () => {
    expect(qk.vaultAnalytics(first, "vault", ["A", "B"])).toEqual([
      "vault-analytics", first, "vault", ["A", "B"],
    ]);
    expect(qk.searchHistory(first, "A")).toEqual(["search-history", first, "A"]);
  });
});
