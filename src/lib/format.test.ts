import { describe, expect, test } from "bun:test";
import { formatQuCompact, formatUsdFromQu } from "@/lib/format";

describe("formatQuCompact", () => {
  test("keeps bigint values exact around compact thresholds", () => {
    expect(formatQuCompact(999n)).toBe("999");
    expect(formatQuCompact(1_500n)).toBe("1.5K");
    expect(formatQuCompact(1_250_000n)).toBe("1.25M");
    expect(formatQuCompact(9_876_543_210n)).toBe("9.87B");
  });

  test("preserves sign for negative values", () => {
    expect(formatQuCompact(-1_500n)).toBe("-1.5K");
  });
});

describe("formatUsdFromQu", () => {
  test("formats bigint balances without passing through unsafe numbers", () => {
    expect(formatUsdFromQu(12_345_678_901_234_567n, 0.01)).toBe("123,456,789,012,345.67");
  });

  test("rejects invalid prices", () => {
    expect(formatUsdFromQu(100n, Number.NaN)).toBe("—");
  });
});
