import { useState } from "react";
import { parseAccountTags } from "@/lib/accounts";
import { removeFromWallet, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore, type AccountMeta, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Account rename, metadata, visibility, and removal state for one wallet. */
export function useWalletAccountActions(wallet: WalletMeta | undefined, isActive: boolean) {
  const updateWallet = usePersistedStore((s) => s.updateWallet);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const activeAccountIndex = usePersistedStore((s) => s.settings.activeAccountIndex);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const [renamingAccount, setRenamingAccount] = useState<AccountMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMeta, setEditingMeta] = useState<AccountMeta | null>(null);
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
    if (!wallet || !renamingAccount || !renameValue.trim()) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((a) =>
        a.index === renamingAccount.index ? { ...a, name: renameValue.trim() } : a,
      ),
    });
    setRenamingAccount(null);
  }

  function openMeta(account: AccountMeta) {
    setEditingMeta(account);
    setMetaTags((account.tags ?? []).join(", "));
  }

  function saveAccountMeta() {
    if (!wallet || !editingMeta) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((account) =>
        account.index === editingMeta.index
          ? { ...account, tags: parseAccountTags(metaTags) }
          : account,
      ),
    });
    setEditingMeta(null);
  }

  function toggleHide(account: AccountMeta) {
    if (!wallet) return;
    if (!account.hidden) {
      setHidingAccount(account);
      return;
    }
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((a) =>
        a.index === account.index ? { ...a, hidden: false } : a,
      ),
    });
  }

  function confirmHide() {
    if (!wallet || !hidingAccount) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((a) =>
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
    if (!wallet || !removingAccount) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      const newEncrypted = await removeFromWallet(wallet.encryptedData!, removePassword, removingAccount.index);
      const updatedAccounts = wallet.accounts
        .filter((a) => a.index !== removingAccount.index)
        .map((a) => ({ ...a, index: a.index > removingAccount.index ? a.index - 1 : a.index }));
      updateWallet(wallet.id, { encryptedData: newEncrypted, accounts: updatedAccounts });
      if (isActive) {
        const wallets = await unlockWalletSession(newEncrypted, removePassword);
        sessionUnlock(wallet.id, wallets);
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
