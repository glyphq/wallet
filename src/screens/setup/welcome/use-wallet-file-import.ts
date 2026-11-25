import { useState } from "react";
import { useNavigate } from "react-router";
import { MAX_WALLET_ACCOUNTS } from "@/hooks/use-wallet-balances";
import { newId } from "@/lib/crypto";
import { selectWalletAccounts, type WalletData, unlockWalletSession } from "@/lib/wallet";
import { parseWalletImportFile, restoreImportedWalletExtras, type WalletImportData } from "@/screens/wallets/wallet-import";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

export type ImportFileData = WalletImportData;

/** Reads a wallet backup file, validates it, and adds the selected accounts as a new wallet. */
export function useWalletFileImport() {
  const navigate = useNavigate();
  const addWallet = usePersistedStore((s) => s.addWallet);
  const setActiveWallet = usePersistedStore((s) => s.setActiveWallet);
  const unlock = useSessionStore((s) => s.unlock);

  const [importData, setImportData] = useState<WalletImportData | null>(null);
  const [importPw, setImportPw] = useState("");
  const [importError, setImportError] = useState("");
  const [importFileError, setImportFileError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  function resetImportFileError() {
    setImportFileError("");
  }

  async function loadImportText(text: string) {
    const parsed = await parseWalletImportFile(text);
    setImportData(parsed);
    const accounts = parsed.accounts;
    if (accounts.length > MAX_WALLET_ACCOUNTS) {
      const sorted = [...accounts].sort((a, b) => a.index - b.index);
      setSelectedIndices(new Set(sorted.slice(0, MAX_WALLET_ACCOUNTS).map((account) => account.index)));
    } else {
      setSelectedIndices(new Set());
    }
    setImportPw("");
    setImportError("");
  }

  function failImport() {
    setImportData(null);
    setImportPw("");
    setImportError("");
    setImportFileError("Invalid or unsupported wallet backup. Choose a Glyph export and try again.");
  }

  async function importFile(file: File) {
    resetImportFileError();
    try {
      await loadImportText(await file.text());
    } catch {
      failImport();
    }
  }

  function cancelImport() {
    setImportData(null);
    setImportPw("");
    setImportError("");
    setImportFileError("");
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
      } else if (next.size < MAX_WALLET_ACCOUNTS) {
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
      let finalEncryptedData: WalletData = importData.wallet;

      if (importData.accounts.length > MAX_WALLET_ACCOUNTS) {
        const sortedSelected = [...selectedIndices].sort((a, b) => a - b);
        const byIndex = new Map(importData.accounts.map((account) => [account.index, account]));
        finalAccounts = sortedSelected.map((origIdx, newIdx) => ({ ...byIndex.get(origIdx)!, index: newIdx }));
        finalEncryptedData = await selectWalletAccounts(importData.wallet, importPw, sortedSelected);
      }

      const accounts = await unlockWalletSession(finalEncryptedData, importPw);
      const newWalletId = newId();
      addWallet({
        id: newWalletId,
        name: importData.name,
        color: importData.color,
        icon: importData.icon,
        kind: "seeded",
        createdAt: Date.now(),
        lastUnlockedAt: Date.now(),
        accounts: finalAccounts,
        encryptedData: finalEncryptedData,
      });
      restoreImportedWalletExtras(importData);
      setActiveWallet(newWalletId);
      unlock(newWalletId, accounts);
      navigate("/dashboard", { replace: true });
    } catch {
      setImportError("Could not import this wallet. Check the password and try again.");
    } finally {
      setImportLoading(false);
    }
  }

  const importNeedsSelection = importData !== null && importData.accounts.length > MAX_WALLET_ACCOUNTS;
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
    importNeedsSelection,
    importDisabled,
    openFilePicker,
    importFile,
    cancelImport,
    toggleAccount,
    doImport,
  };
}

export type WalletFileImport = ReturnType<typeof useWalletFileImport>;
