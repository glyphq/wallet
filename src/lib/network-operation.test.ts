import { describe, expect, test } from "bun:test";
import {
  assertNetworkScopeUnchanged,
  NetworkChangedError,
} from "./network-operation";

describe("assertNetworkScopeUnchanged", () => {
  test("allows an operation to continue on the captured network instance", () => {
    expect(() => assertNetworkScopeUnchanged(
      "qubic:testnet:local:instance-a",
      "qubic:testnet:local:instance-a",
    )).not.toThrow();
  });

  test("fails closed after a network or local chain-generation switch", () => {
    for (const currentScope of [
      "qubic:mainnet",
      "qubic:testnet:local:instance-b",
      "",
    ]) {
      expect(() => assertNetworkScopeUnchanged(
        "qubic:testnet:local:instance-a",
        currentScope,
      )).toThrow(NetworkChangedError);
    }
  });
});
