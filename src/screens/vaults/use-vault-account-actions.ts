import { useState } from "react";
import { parseAccountTags } from "@/lib/accounts";
import { removeFromVault, unlockVaultSession } from "@/lib/vault";
import { usePersistedStore, type AccountMeta, type VaultMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Account rename, metadata, visibility, and removal state for one vault. */
export function useVaultAccountActions(vault: VaultMeta | undefined, isActive: boolean) {
  const updateVault = usePersistedStore((s) => s.updateVault);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const activeAccountIndex = usePersistedStore((s) => s.settings.activeAccountIndex);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const [renamingAccount, setRenamingAccount] = useState<AccountMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMeta, setEditingMeta] = useState<AccountMeta | null>(null);
  const [metaNote, setMetaNote] = useState("");
  const [metaTags, setMetaTags] = useState("");
  const [removingAccount, setRemovingAccount] = useState<AccountMeta | null>(null);
  const [removePassword, setRemovePassword] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);
  const [hidingAccount, setHidingAccount] = useState<AccountMeta | null>(null);

  function openRename(account: AccountMeta) {
    setRenamingAccount(account);
    setRenameValue(account.name);
  }

  function doRename() {
    if (!vault || !renamingAccount || !renameValue.trim()) return;
    updateVault(vault.id, {
      accounts: vault.accounts.map((a) =>
        a.index === renamingAccount.index ? { ...a, name: renameValue.trim() } : a,
      ),
    });
    setRenamingAccount(null);
  }

  function openMeta(account: AccountMeta) {
    setEditingMeta(account);
    setMetaNote(account.note ?? "");
    setMetaTags((account.tags ?? []).join(", "));
  }

  function saveAccountMeta() {
    if (!vault || !editingMeta) return;
    updateVault(vault.id, {
      accounts: vault.accounts.map((account) =>
        account.index === editingMeta.index
          ? { ...account, note: metaNote.trim(), tags: parseAccountTags(metaTags) }
          : account,
      ),
    });
    setEditingMeta(null);
  }

  function toggleHide(account: AccountMeta) {
    if (!vault) return;
    if (!account.hidden) {
      setHidingAccount(account);
      return;
    }
    updateVault(vault.id, {
      accounts: vault.accounts.map((a) =>
        a.index === account.index ? { ...a, hidden: false } : a,
      ),
    });
  }

  function confirmHide() {
    if (!vault || !hidingAccount) return;
    updateVault(vault.id, {
      accounts: vault.accounts.map((a) =>
        a.index === hidingAccount.index ? { ...a, hidden: true } : a,
      ),
    });
    setHidingAccount(null);
  }

  function openRemove(account: AccountMeta) {
    setRemovingAccount(account);
    setRemovePassword("");
    setRemoveError("");
  }

  async function doRemove() {
    if (!vault || !removingAccount) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      const newEncrypted = await removeFromVault(vault.encryptedData!, removePassword, removingAccount.index);
      const updatedAccounts = vault.accounts
        .filter((a) => a.index !== removingAccount.index)
        .map((a) => ({ ...a, index: a.index > removingAccount.index ? a.index - 1 : a.index }));
      updateVault(vault.id, { encryptedData: newEncrypted, accounts: updatedAccounts });
      if (isActive) {
        const wallets = await unlockVaultSession(newEncrypted, removePassword);
        sessionUnlock(vault.id, wallets);
        if (removingAccount.index === activeAccountIndex) {
          setActiveAccountIndex(0);
        } else if (removingAccount.index < activeAccountIndex) {
          setActiveAccountIndex(activeAccountIndex - 1);
        }
      }
      setRemovingAccount(null);
    } catch {
      setRemoveError("Wrong password");
    } finally {
      setRemoveLoading(false);
    }
  }

  return {
    renamingAccount,
    setRenamingAccount,
    renameValue,
    setRenameValue,
    openRename,
    doRename,
    editingMeta,
    setEditingMeta,
    metaNote,
    setMetaNote,
    metaTags,
    setMetaTags,
    openMeta,
    saveAccountMeta,
    removingAccount,
    setRemovingAccount,
    removePassword,
    setRemovePassword,
    removeError,
    setRemoveError,
    removeLoading,
    openRemove,
    doRemove,
    hidingAccount,
    setHidingAccount,
    toggleHide,
    confirmHide,
  };
}
