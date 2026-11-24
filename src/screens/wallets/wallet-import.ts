import { parseSignedExportEnvelope } from "@/lib/export-format";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import type { WalletData } from "@/lib/wallet";
import type { AccountMeta, WalletColor, WalletIconId } from "@/store/persisted";

export interface WalletImportData {
  name: string;
  color: WalletColor;
  icon: WalletIconId;
  accounts: AccountMeta[];
  wallet: WalletData;
  formatVersion: number;
  signatureVerified: boolean;
  legacy: boolean;
}

/** Parses and sanitizes a wallet export file's text; throws when the file is unsupported. */
export async function parseWalletImportFile(text: string): Promise<WalletImportData> {
  const parsed = await parseSignedExportEnvelope<{
    glyph: number;
    name: string;
    color: WalletColor;
    icon?: WalletIconId;
    accounts: unknown[];
    wallet?: WalletData;
    /** Pre-rename encrypted payload key. */
    vault?: WalletData;
  }>(text, "wallet");
  const walletData = parsed.payload.wallet ?? parsed.payload.vault;
  if (parsed.payload.glyph !== 1 || !walletData || !parsed.payload.name?.trim()) throw new Error();
  const rawAccounts: unknown[] = Array.isArray(parsed.payload.accounts) ? parsed.payload.accounts : [];
  const sanitizedAccounts: AccountMeta[] = rawAccounts
    .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object" && !Array.isArray(a))
    .map((a, i) => ({
      index: typeof a.index === "number" && Number.isInteger(a.index) && a.index >= 0 ? a.index : i,
      name: typeof a.name === "string" && a.name.trim() ? a.name.trim().slice(0, 64) : `Account ${i + 1}`,
      addedAt: typeof a.addedAt === "number" && a.addedAt > 0 ? a.addedAt : Date.now(),
      hidden: a.hidden === true,
    }));
  return {
    name: parsed.payload.name,
    color: parsed.payload.color ?? DEFAULT_WALLET_COLOR,
    icon: parsed.payload.icon ?? DEFAULT_WALLET_ICON,
    accounts: sanitizedAccounts,
    wallet: walletData,
    formatVersion: parsed.version,
    signatureVerified: parsed.verified,
    legacy: parsed.legacy,
  };
}
