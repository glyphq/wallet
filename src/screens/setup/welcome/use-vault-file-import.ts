import { useState } from "react";
import { useNavigate } from "react-router";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
import { newId } from "@/lib/crypto";
import { parseSignedExportEnvelope } from "@/lib/export-format";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { selectVaultAccounts, type VaultData, unlockVaultSession } from "@/lib/vault";
import { usePersistedStore, type AccountMeta, type VaultColor, type WalletIconId } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

export interface ImportFileData {
  name: string;
  color: VaultColor;
  icon?: WalletIconId;
  accounts: AccountMeta[];
  vault: VaultData;
  formatVersion: number;
  signatureVerified: boolean;
  legacy: boolean;
}

/** Reads a Vault export file, validates it, and adds the selected accounts as a new Vault. */
export function useVaultFileImport() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((s) => s.addVault);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const unlock = useSessionStore((s) => s.unlock);

  const [importData, setImportData] = useState<ImportFileData | null>(null);
  const [importPw, setImportPw] = useState("");
  const [importError, setImportError] = useState("");
  const [importFileError, setImportFileError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importWalletIcon, setImportWalletIcon] = useState<WalletIconId>(DEFAULT_WALLET_ICON);
  const [importWalletColor, setImportWalletColor] = useState<VaultColor>(DEFAULT_WALLET_COLOR);

  function resetImportFileError() {
    setImportFileError("");
  }

  async function loadImportText(text: string) {
    const parsed = await parseSignedExportEnvelope<{
      glyph: number;
      name: string;
      color: VaultColor;
      icon?: WalletIconId;
      accounts: AccountMeta[];
      vault: VaultData;
    }>(text, "vault");
    const envelopePayload = parsed.payload;
    if (envelopePayload.glyph !== 1 || !envelopePayload.vault || !envelopePayload.name?.trim()) {
      throw new Error("bad format");
    }
    const accounts: AccountMeta[] = envelopePayload.accounts ?? [];
    setImportData({
      name: envelopePayload.name,
      color: envelopePayload.color ?? DEFAULT_WALLET_COLOR,
      icon: envelopePayload.icon ?? DEFAULT_WALLET_ICON,
      accounts,
      vault: envelopePayload.vault as VaultData,
      formatVersion: parsed.version,
      signatureVerified: parsed.verified,
      legacy: parsed.legacy,
    });
    if (accounts.length > MAX_VAULT_ACCOUNTS) {
      const sorted = [...accounts].sort((a, b) => a.index - b.index);
      setSelectedIndices(new Set(sorted.slice(0, MAX_VAULT_ACCOUNTS).map((account) => account.index)));
    } else {
      setSelectedIndices(new Set());
    }
    setImportPw("");
    setImportError("");
    setImportWalletColor(envelopePayload.color ?? DEFAULT_WALLET_COLOR);
    setImportWalletIcon(envelopePayload.icon ?? DEFAULT_WALLET_ICON);
  }

  function failImport() {
    setImportData(null);
    setImportPw("");
    setImportError("");
    setImportFileError("Invalid or unsupported Vault file. Choose a Glyph export and try again.");
  }

  async function importFile(file: File) {
    resetImportFileError();
    try {
      await loadImportText(await file.text());
    } catch {
      failImport();
    }
  }

  async function importPath(path: string) {
    resetImportFileError();
    try {
      await loadImportText(await readTextFile(path));
    } catch {
      failImport();
    }
  }

  function openFilePicker() {
    resetImportFileError();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void importFile(file);
    };
    input.click();
  }

  function toggleAccount(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < MAX_VAULT_ACCOUNTS) {
        next.add(index);
      }
      return next;
    });
  }

  async function doImport() {
    if (!importData) return;
    setImportLoading(true);
    setImportError("");
    try {
      let finalAccounts = importData.accounts;
      let finalEncryptedData: VaultData = importData.vault;

      if (importData.accounts.length > MAX_VAULT_ACCOUNTS) {
        const sortedSelected = [...selectedIndices].sort((a, b) => a - b);
        const byIndex = new Map(importData.accounts.map((account) => [account.index, account]));
        finalAccounts = sortedSelected.map((origIdx, newIdx) => ({ ...byIndex.get(origIdx)!, index: newIdx }));
        finalEncryptedData = await selectVaultAccounts(importData.vault, importPw, sortedSelected);
      }

      const wallets = await unlockVaultSession(finalEncryptedData, importPw);
      const newVaultId = newId();
      addVault({
        id: newVaultId,
        name: importData.name,
        color: importWalletColor,
        icon: importWalletIcon,
        kind: "seeded",
        createdAt: Date.now(),
        lastUnlockedAt: Date.now(),
        accounts: finalAccounts,
        encryptedData: finalEncryptedData,
      });
      setActiveVault(newVaultId);
      unlock(newVaultId, wallets);
      navigate("/dashboard", { replace: true });
    } catch {
      setImportError("Could not import this Vault. Check the password and try again.");
    } finally {
      setImportLoading(false);
    }
  }

  const importNeedsSelection = importData !== null && importData.accounts.length > MAX_VAULT_ACCOUNTS;
  const importDisabled = !importPw || importLoading || (importNeedsSelection && selectedIndices.size === 0);

  return {
    importData,
    setImportData,
    importPw,
    setImportPw,
    importError,
    setImportError,
    importFileError,
    importLoading,
    selectedIndices,
    importWalletIcon,
    setImportWalletIcon,
    importWalletColor,
    setImportWalletColor,
    importNeedsSelection,
    importDisabled,
    openFilePicker,
    importFile,
    importPath,
    toggleAccount,
    doImport,
  };
}

export type VaultFileImport = ReturnType<typeof useVaultFileImport>;
