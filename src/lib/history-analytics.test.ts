import { describe, expect, test } from "bun:test";
import { buildVaultAnalytics } from "@/lib/history-analytics";

describe("buildVaultAnalytics", () => {
  test("sorts monthly summaries chronologically instead of by localized label", () => {
    const analytics = buildVaultAnalytics(
      new Set(["ME"]),
      [
        {
          hash: "jan-2025",
          source: null,
          destination: "ME",
          amount: "100",
          timestamp: Date.UTC(2025, 0, 15),
          moneyFlew: true,
        },
        {
          hash: "dec-2024",
          source: null,
          destination: "ME",
          amount: "200",
          timestamp: Date.UTC(2024, 11, 15),
          moneyFlew: true,
        },
      ],
    );

    expect(analytics.monthlySummaries).toHaveLength(2);
    expect(analytics.monthlySummaries[0]?.sortKey).toBe(202501);
    expect(analytics.monthlySummaries[1]?.sortKey).toBe(202412);
  });
});
