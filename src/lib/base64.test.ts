import { expect, test } from "bun:test";
import { base64ToBytes } from "./base64";

test("base64ToBytes decodes valid data and safely rejects malformed input", () => {
  expect([...base64ToBytes("SGVsbG8=")]).toEqual([72, 101, 108, 108, 111]);
  expect(base64ToBytes("not valid base64!")).toHaveLength(0);
});
