import { describe, expect, test } from "bun:test";
import { zeroBytes } from "./secure-session";

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
