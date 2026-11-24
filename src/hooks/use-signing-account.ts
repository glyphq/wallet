import { useState, useEffect } from "react";
import { useSessionStore } from "@/store/session";
import { usePersistedStore, type WalletMeta } from "@/store/persisted";
import type { SessionAccount } from "@/lib/session-account";

export interface SigningAccount {
  account: SessionAccount | null;
  wallet: WalletMeta | null;
  accountName: string;
  /** Set when `from` was specified but the address isn't in the unlocked wallet. */
  fromError: string | null;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  /** Show account picker — true when from is omitted and the wallet has >1 account. */
  showPicker: boolean;
}

/** Resolves the signing account and wallet metadata, optionally pinned to a specific `from` address. */
export function useSigningAccount(from?: string): SigningAccount {
  const accounts = useSessionStore((s) => s.accounts);
  const settings = usePersistedStore((s) => s.settings);
  const unlockedWalletId = useSessionStore((s) => s.unlockedWalletId);
  const wallet = usePersistedStore((s) =>
    s.wallets.find((w) => w.id === unlockedWalletId) ?? s.wallets.find((w) => w.id === s.settings.activeWalletId) ?? null,
  );

  const [selectedIndex, setSelectedIndex] = useState(settings.activeAccountIndex);

  // Keep in sync when the active account changes externally (e.g. user switches
  // accounts on another screen while the request screen is already open).
  useEffect(() => {
    setSelectedIndex(settings.activeAccountIndex);
  }, [settings.activeAccountIndex]);

  const nameAt = (i: number) => {
    const account = accounts[i];
    return account?.accountName ?? wallet?.accounts.find((a) => a.identity === account?.identity)?.name ?? `Account ${i + 1}`;
  };

  if (accounts.length === 0) {
    return { account: null, wallet, accountName: "", fromError: null, selectedIndex: 0, setSelectedIndex, showPicker: false };
  }

  if (from) {
    const idx = accounts.findIndex((account) => account.identity === from);
    if (idx === -1) {
      return {
        account: null,
        wallet,
        accountName: "",
        fromError: "Address not in the unlocked wallet",
        selectedIndex: -1,
        setSelectedIndex,
        showPicker: false,
      };
    }
    return {
      account: accounts[idx],
      wallet,
      accountName: nameAt(idx),
      fromError: null,
      selectedIndex: idx,
      setSelectedIndex,
      showPicker: false,
    };
  }

  const effectiveIndex = Math.min(Math.max(0, selectedIndex), accounts.length - 1);
  return {
    account: accounts[effectiveIndex] ?? null,
    wallet,
    accountName: nameAt(effectiveIndex),
    fromError: null,
    selectedIndex: effectiveIndex,
    setSelectedIndex,
    showPicker: accounts.length > 1,
  };
}
