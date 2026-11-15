import { useState } from "react";
import { deriveIdentityFromSeed, generateRandomSeed, toSeed, InvalidSeedError, type Seed } from "@/lib/crypto";
import { addToVault, unlockVaultSession } from "@/lib/vault";
import { usePersistedStore, type AccountMeta, type VaultMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Owns the add-account sheet state and the vault mutation that appends a new account. */
export function useVaultAddAccount(vault: VaultMeta | undefined, isActive: boolean) {
  const updateVault = usePersistedStore((s) => s.updateVault);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const [addingAccount, setAddingAccount] = useState(false);
  const [newlyAddedIndex, setNewlyAddedIndex] = useState<number | null>(null);
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
    if (!vault || !addName.trim()) return;
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
      const newEncrypted = await addToVault(vault.encryptedData!, addPassword, newSeed);
      const newIndex = vault.accounts.length;
      const newAccount: AccountMeta = {
        index: newIndex,
        name: addName.trim(),
        addedAt: Date.now(),
        hidden: false,
        identity: deriveIdentityFromSeed(newSeed),
        note: "",
        tags: [],
      };
      updateVault(vault.id, {
        encryptedData: newEncrypted,
        accounts: [...vault.accounts, newAccount],
      });
      if (isActive) {
        const wallets = await unlockVaultSession(newEncrypted, addPassword);
        sessionUnlock(vault.id, wallets);
      }
      setNewlyAddedIndex(newIndex);
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
    newlyAddedIndex,
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
