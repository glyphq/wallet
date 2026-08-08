import { describe, expect, test } from "bun:test";
import { createAccountBalanceWidgetConfig, createVaultBalanceWidgetConfig, formatWidgetQu } from "./glyph-balance-widget";

function textContents(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own = typeof record.content === "string" ? [record.content] : typeof record.text === "string" ? [record.text] : [];
  const children = Array.isArray(record.children) ? record.children.flatMap(textContents) : [];
  return [...own, ...children];
}

describe("balance widget helpers", () => {
  test("formats bigint balances without precision-losing number conversion", () => {
    expect(formatWidgetQu(9007199254740993123456789n)).toBe("9007199254740993123.45 QU");
    expect(formatWidgetQu(1234567n)).toBe("1.23 QU");
  });

  test("creates visible account balance configs", () => {
    const config = createAccountBalanceWidgetConfig({
      accountName: "Primary",
      balance: 987654321n,
      balanceVisible: true,
      accountCount: 3,
    });

    expect(config.small?.type).toBe("vstack");
    expect(textContents(config.small)).toContain("Primary");
    expect(textContents(config.small)).toContain("987.65 QU");
    expect(textContents(config.small)).toContain("3 accounts in vault");
  });

  test("masks account balances when privacy or lock state hides values", () => {
    const hiddenByPrivacy = createAccountBalanceWidgetConfig({ accountName: "Primary", balance: 42n, balanceVisible: false });
    const hiddenByLock = createAccountBalanceWidgetConfig({ accountName: "Primary", balance: 42n, balanceVisible: true, vaultUnlocked: false });

    expect(textContents(hiddenByPrivacy.small)).toContain("•••••• QU");
    expect(textContents(hiddenByPrivacy.small)).not.toContain("0.000042 QU");
    expect(textContents(hiddenByLock.small)).toContain("•••••• QU");
    expect(textContents(hiddenByLock.small)).toContain("Unlock Glyph to view balances");
  });

  test("creates vault totals and respects balancesReady", () => {
    const syncing = createVaultBalanceWidgetConfig({ balanceVisible: true, accountCount: 2, balancesReady: false });
    const ready = createVaultBalanceWidgetConfig({ balance: 5000000n, balanceVisible: true, accountCount: 1, balancesReady: true });
    const masked = createVaultBalanceWidgetConfig({ balance: 5000000n, balanceVisible: false, accountCount: 1, balancesReady: true });

    expect(textContents(syncing.small)).toContain("Syncing…");
    expect(textContents(ready.small)).toContain("5 QU");
    expect(textContents(ready.small)).toContain("1 account");
    expect(textContents(masked.small)).toContain("•••••• QU");
    expect(textContents(masked.small)).not.toContain("5 QU");
  });
});
