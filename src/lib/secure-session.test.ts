import { describe, expect, test } from "bun:test";
import { messageSigningIntent, transactionSigningIntent, zeroBytes } from "./secure-session";

describe("zeroBytes", () => {
  test("wipes an attached byte view", () => {
    const bytes = new Uint8Array([1, 2, 3]);

    zeroBytes(bytes);

    expect([...bytes]).toEqual([0, 0, 0]);
  });

  test("does not throw after its buffer is transferred", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    structuredClone(null, { transfer: [bytes.buffer] });

    expect(bytes.byteLength).toBe(0);
    expect(() => zeroBytes(bytes)).not.toThrow();
  });
});

describe("reviewed signing intents", () => {
  test("binds transaction account, destination, amount, input, and payload", () => {
    expect(transactionSigningIntent({
      accountIndex: 1,
      destination: "DESTINATION",
      amount: 42n,
      inputType: 7,
      payload: new Uint8Array([1, 2]),
    })).toBe(JSON.stringify({
      kind: "transaction",
      accountIndex: 1,
      destination: "DESTINATION",
      amount: "42",
      inputType: 7,
      payload: [1, 2],
    }));
  });

  test("changes when the reviewed message bytes or account changes", () => {
    const first = messageSigningIntent(0, new Uint8Array([1, 2]));
    expect(messageSigningIntent(0, new Uint8Array([1, 3]))).not.toBe(first);
    expect(messageSigningIntent(1, new Uint8Array([1, 2]))).not.toBe(first);
  });
});
