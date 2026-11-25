import { useState } from "react";
import { deriveIdentityFromSeed, generateRandomSeed, toSeed, InvalidSeedError, type Seed } from "@/lib/crypto";
import { addToWallet, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore, type AccountMeta, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Owns the add-account screen state and the wallet mutation that appends a new account. */
export function useWalletAddAccount(wallet: WalletMeta | undefined, isActive: boolean) {
  const updateWallet = usePersistedStore((s) => s.updateWallet);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const [addingAccount, setAddingAccount] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "import">("new");
  const [addName, setAddName] = useState("");
  const [addSeed, setAddSeed] = useState("");
  const [addSeedError, setAddSeedError] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  function openAdd() {
    setAddMode("new");
    setAddName("");
    setAddSeed("");
    setAddSeedError("");
    setAddPassword("");
    setAddError("");
    setAddingAccount(true);
  }

  async function doAdd() {
    if (!wallet || !addName.trim()) return;
    setAddSeedError("");
    setAddError("");

    let seedToAdd: Seed | null = null;
    if (addMode === "import") {
      try {
        seedToAdd = toSeed(addSeed.trim().toLowerCase());
      } catch (e) {
        setAddSeedError(e instanceof InvalidSeedError ? "55 lowercase letters required" : "Invalid seed");
        return;
      }
    }

    setAddLoading(true);
    try {
      const newSeed = seedToAdd ?? generateRandomSeed();
      const newEncrypted = await addToWallet(wallet.encryptedData!, addPassword, newSeed);
      const newIndex = wallet.accounts.length;
      const newAccount: AccountMeta = {
        index: newIndex,
        name: addName.trim(),
        addedAt: Date.now(),
        identity: deriveIdentityFromSeed(newSeed),
        note: "",
      };
      updateWallet(wallet.id, {
        encryptedData: newEncrypted,
        accounts: [...wallet.accounts, newAccount],
      });
      if (isActive) {
        const wallets = await unlockWalletSession(newEncrypted, addPassword);
        sessionUnlock(wallet.id, wallets);
      }
      setAddingAccount(false);
    } catch {
      setAddError("Wrong password");
    } finally {
      setAddLoading(false);
    }
  }

  return {
    addingAccount,
    setAddingAccount,
    addMode,
    setAddMode,
    addName,
    setAddName,
    addSeed,
    setAddSeed,
    addSeedError,
    setAddSeedError,
    addPassword,
    setAddPassword,
    addError,
    setAddError,
    addLoading,
    openAdd,
    doAdd,
  };
}
