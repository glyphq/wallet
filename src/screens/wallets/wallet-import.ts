import { isValidIdentity, newId } from "@/lib/crypto";
import { parseSignedExportEnvelope } from "@/lib/export-format";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import type { WalletData } from "@/lib/wallet";
import { usePersistedStore, type AccountMeta, type Contact, type WalletColor, type WalletIconId } from "@/store/persisted";

export interface WalletImportData {
  name: string;
  color: WalletColor;
  icon: WalletIconId;
  accounts: AccountMeta[];
  contacts: Contact[];
  memos: Record<string, string>;
  wallet: WalletData;
  formatVersion: number;
  signatureVerified: boolean;
  legacy: boolean;
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = [...new Set(
    value
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean),
  )].slice(0, 8);
  return tags.length > 0 ? tags : undefined;
}

/** Restores app-level contacts and memos carried by a wallet backup without overwriting local data. */
export function restoreImportedWalletExtras(data: WalletImportData): void {
  const store = usePersistedStore.getState();
  const identities = new Set(store.contacts.map((contact) => contact.identity));
  for (const contact of data.contacts) {
    if (identities.has(contact.identity)) continue;
    store.addContact({ ...contact, id: newId() });
    identities.add(contact.identity);
  }
  for (const [hash, memo] of Object.entries(data.memos)) {
    if (!store.txMemos[hash]) store.setTxMemo(hash, memo);
  }
}

/** Parses and sanitizes a wallet export file's text; throws when the file is unsupported. */
export async function parseWalletImportFile(text: string): Promise<WalletImportData> {
  const parsed = await parseSignedExportEnvelope<{
    glyph: number;
    name: string;
    color: WalletColor;
    icon?: WalletIconId;
    accounts: unknown[];
    contacts?: unknown;
    memos?: unknown;
    wallet?: WalletData;
    /** Pre-rename encrypted payload key. */
    vault?: WalletData;
  }>(text, "wallet");
  const walletData = parsed.payload.wallet ?? parsed.payload.vault;
  if (parsed.payload.glyph !== 1 || !walletData || !parsed.payload.name?.trim()) throw new Error();
  const rawAccounts: unknown[] = Array.isArray(parsed.payload.accounts) ? parsed.payload.accounts : [];
  const sanitizedAccounts: AccountMeta[] = rawAccounts
    .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object" && !Array.isArray(a))
    .map((a, i) => {
      const identity = typeof a.identity === "string" ? a.identity.trim().toUpperCase() : "";
      return {
        index: typeof a.index === "number" && Number.isInteger(a.index) && a.index >= 0 ? a.index : i,
        name: typeof a.name === "string" && a.name.trim() ? a.name.trim().slice(0, 64) : `Account ${i + 1}`,
        addedAt: typeof a.addedAt === "number" && a.addedAt > 0 ? a.addedAt : Date.now(),
        hidden: a.hidden === true,
        identity: isValidIdentity(identity) ? identity : undefined,
        note: typeof a.note === "string" ? a.note.slice(0, 2000) : undefined,
        tags: sanitizeTags(a.tags),
      };
    });

  const rawContacts: unknown[] = Array.isArray(parsed.payload.contacts) ? parsed.payload.contacts : [];
  const contacts: Contact[] = rawContacts.flatMap((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
    const contact = value as Record<string, unknown>;
    const identity = typeof contact.identity === "string" ? contact.identity.trim().toUpperCase() : "";
    if (!isValidIdentity(identity)) return [];
    return [{
      id: newId(),
      name: typeof contact.name === "string" && contact.name.trim() ? contact.name.trim().slice(0, 64) : "Contact",
      identity,
      addedAt: typeof contact.addedAt === "number" && contact.addedAt > 0 ? contact.addedAt : Date.now(),
      lastUsedAt: typeof contact.lastUsedAt === "number" && contact.lastUsedAt > 0 ? contact.lastUsedAt : 0,
      tags: sanitizeTags(contact.tags),
    }];
  });

  const rawMemos = parsed.payload.memos;
  const memos = rawMemos !== null && typeof rawMemos === "object" && !Array.isArray(rawMemos)
    ? Object.fromEntries(
        Object.entries(rawMemos as Record<string, unknown>)
          .filter(([hash, memo]) => hash.length > 0 && typeof memo === "string" && memo.trim().length > 0)
          .map(([hash, memo]) => [hash, (memo as string).slice(0, 2000)]),
      )
    : {};

  return {
    name: parsed.payload.name,
    color: parsed.payload.color ?? DEFAULT_WALLET_COLOR,
    icon: parsed.payload.icon ?? DEFAULT_WALLET_ICON,
    accounts: sanitizedAccounts,
    contacts,
    memos,
    wallet: walletData,
    formatVersion: parsed.version,
    signatureVerified: parsed.verified,
    legacy: parsed.legacy,
  };
}
