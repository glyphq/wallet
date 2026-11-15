import { describe, expect, test } from "bun:test";
import {
  CONTRACT_NAMES,
  CONTRACT_PROCEDURE_NAMES,
  KNOWN_CONTRACT_ADDRESSES,
  QEARN_CONTRACT_INDEX,
  Q_UTIL_CONTRACT_INDEX,
  Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  resolveProcedureName,
} from "@/lib/contracts";

describe("contract registry", () => {
  test("maps every known contract index to a display name and address", () => {
    for (const [index, name] of Object.entries(CONTRACT_NAMES)) {
      expect(name.length).toBeGreaterThan(0);
      const address = Object.entries(KNOWN_CONTRACT_ADDRESSES).find(([, label]) => label === name)?.[0];
      expect(address).toBeDefined();
      expect(Number(index)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("resolveProcedureName", () => {
  test("resolves the procedure from the receiving contract", () => {
    expect(resolveProcedureName(CONTRACT_NAMES[QEARN_CONTRACT_INDEX], undefined, 1)).toBe("Lock");
  });

  test("falls back to the sending contract", () => {
    const expected = CONTRACT_PROCEDURE_NAMES[`${Q_UTIL_CONTRACT_INDEX}:${Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE}`];
    expect(expected).toBeTruthy();
    expect(resolveProcedureName(undefined, CONTRACT_NAMES[Q_UTIL_CONTRACT_INDEX], Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE)).toBe(expected);
  });

  test("returns undefined for unknown contracts, procedures, or missing input type", () => {
    expect(resolveProcedureName("Not A Contract", undefined, 1)).toBeUndefined();
    expect(resolveProcedureName(undefined, undefined, 1)).toBeUndefined();
    expect(resolveProcedureName("Qearn", undefined, null)).toBeUndefined();
    expect(resolveProcedureName("Qearn", undefined, 65_535)).toBeUndefined();
  });
});
