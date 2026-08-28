import { describe, expect, test } from "bun:test";
import { broadcastTx } from "@/lib/broadcast";
import { NetworkChangedError } from "@/lib/network-operation";

describe("network-bound broadcast", () => {
  test("does not emit when the active network changed after signing", async () => {
    let emitted = false;
    await expect(broadcastTx("signed", "qubic:mainnet", {
      getCurrentNetworkScope: () => "qubic:testnet:local:manifest-unresolved",
      broadcast: async () => { emitted = true; return { ok: true }; },
    })).rejects.toBeInstanceOf(NetworkChangedError);
    expect(emitted).toBe(false);
  });

  test("broadcasts exactly once when the captured scope is unchanged", async () => {
    const emitted: string[] = [];
    await broadcastTx("signed", "qubic:mainnet", {
      getCurrentNetworkScope: () => "qubic:mainnet",
      broadcast: async (encoded) => { emitted.push(encoded); return { ok: true }; },
    });
    expect(emitted).toEqual(["signed"]);
  });
});
