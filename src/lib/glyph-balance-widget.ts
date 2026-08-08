import type { WidgetConfig } from "tauri-plugin-widgets-api";

export interface AccountBalanceWidgetConfigInput {
  accountName: string;
  balance?: bigint;
  balanceVisible: boolean;
  accountCount?: number;
  vaultUnlocked?: boolean;
}

export interface VaultBalanceWidgetConfigInput {
  balance?: bigint;
  balanceVisible: boolean;
  accountCount: number;
  balancesReady?: boolean;
  vaultUnlocked?: boolean;
}

const MASKED_BALANCE = "•••••• QU";
const UNKNOWN_BALANCE = "Syncing…";
const QU_BASE = 1_000_000n;

export function formatWidgetQu(balance: bigint | undefined): string {
  if (balance === undefined) return UNKNOWN_BALANCE;

  const sign = balance < 0n ? "-" : "";
  const absolute = balance < 0n ? -balance : balance;
  const whole = absolute / QU_BASE;
  const fraction = absolute % QU_BASE;
  const fractionText = fraction.toString().padStart(6, "0").replace(/0+$/, "");
  const compactFraction = fractionText ? `.${fractionText.slice(0, 2)}` : "";
  return `${sign}${whole.toString()}${compactFraction} QU`;
}

function canReveal(balanceVisible: boolean, vaultUnlocked = true): boolean {
  return balanceVisible && vaultUnlocked;
}

function visibleBalanceText(balance: bigint | undefined, balanceVisible: boolean, vaultUnlocked = true, balancesReady = true): string {
  if (!canReveal(balanceVisible, vaultUnlocked)) return MASKED_BALANCE;
  if (!balancesReady) return UNKNOWN_BALANCE;
  return formatWidgetQu(balance);
}

function accountCountText(accountCount: number | undefined): string {
  if (accountCount === undefined) return "Account balance";
  const safeCount = Math.max(0, accountCount);
  return `${safeCount} account${safeCount === 1 ? "" : "s"} in vault`;
}

function vaultStatusText(input: Pick<VaultBalanceWidgetConfigInput, "balanceVisible" | "accountCount" | "balancesReady" | "vaultUnlocked">): string {
  if (input.vaultUnlocked === false) return "Unlock Glyph to view balances";
  if (!input.balanceVisible) return "Balance hidden by privacy settings";
  if (input.balancesReady === false) return "Refreshing account balances";
  const safeCount = Math.max(0, input.accountCount);
  return `${safeCount} account${safeCount === 1 ? "" : "s"}`;
}

export function createAccountBalanceWidgetConfig(input: AccountBalanceWidgetConfigInput): WidgetConfig {
  const displayedBalance = visibleBalanceText(input.balance, input.balanceVisible, input.vaultUnlocked);
  const subtitle = input.vaultUnlocked === false
    ? "Unlock Glyph to view balances"
    : input.balanceVisible
      ? accountCountText(input.accountCount)
      : "Balance hidden by privacy settings";

  return {
    version: 1,
    small: {
      type: "vstack",
      padding: 16,
      spacing: 10,
      cornerRadius: 22,
      background: { light: "#f7f8fb", dark: "#111318" },
      shadow: { color: "#000000", radius: 10, x: 0, y: 4 },
      children: [
        {
          type: "hstack",
          spacing: 6,
          children: [
            { type: "label", text: "GLYPH", systemName: "shield.fill", fontSize: 12, fontWeight: "bold", color: { light: "#536071", dark: "#b8c2d4" } },
            { type: "spacer" },
            { type: "image", systemName: canReveal(input.balanceVisible, input.vaultUnlocked) ? "eye" : "eye.slash", size: 15, color: { light: "#7b8494", dark: "#9aa6ba" } },
          ],
        },
        { type: "text", content: input.accountName || "Account", textStyle: "caption", fontWeight: "semibold", color: { light: "#687386", dark: "#aab5c8" }, lineLimit: 1 },
        { type: "text", content: displayedBalance, fontSize: 25, fontWeight: "bold", fontDesign: "rounded", color: { light: "#101216", dark: "#f7f9fc" }, lineLimit: 1 },
        { type: "text", content: subtitle, textStyle: "footnote", color: { light: "#6e7686", dark: "#aab5c8" }, lineLimit: 2 },
      ],
    },
  };
}

export function createVaultBalanceWidgetConfig(input: VaultBalanceWidgetConfigInput): WidgetConfig {
  const displayedBalance = visibleBalanceText(input.balance, input.balanceVisible, input.vaultUnlocked, input.balancesReady);

  return {
    version: 1,
    small: {
      type: "vstack",
      padding: 16,
      spacing: 10,
      cornerRadius: 22,
      background: { light: "#eef8f2", dark: "#0f1d16" },
      shadow: { color: "#000000", radius: 10, x: 0, y: 4 },
      children: [
        { type: "label", text: "GLYPH", systemName: "lock.shield", fontSize: 13, fontWeight: "bold", color: { light: "#28513a", dark: "#abe7be" } },
        { type: "text", content: "Vault total", textStyle: "caption", fontWeight: "semibold", color: { light: "#50715d", dark: "#8fcda3" } },
        { type: "text", content: displayedBalance, fontSize: 25, fontWeight: "bold", fontDesign: "rounded", color: { light: "#102018", dark: "#f1fff5" }, lineLimit: 1 },
        { type: "divider", color: { light: "#cfe4d6", dark: "#274332" }, thickness: 1 },
        { type: "text", content: vaultStatusText(input), textStyle: "footnote", color: { light: "#50715d", dark: "#a8dcb8" }, lineLimit: 2 },
      ],
    },
  };
}
