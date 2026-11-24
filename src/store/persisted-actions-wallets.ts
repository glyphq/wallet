import type { PersistedStoreSet } from "./persisted-store-set";
import type { AppSettings, Contact, WalletMeta } from "./persisted-types";

/** Wallet, settings, lockout and contact actions for the persisted store. */
export function createWalletActions(set: PersistedStoreSet) {
  return {
    setPasswordLockoutUntil: (until: number) => set({ passwordLockoutUntil: until }),
    setPasswordAttempts: (n: number) => set({ passwordAttempts: n }),

    addWallet: (wallet: WalletMeta) => set((s) => ({ wallets: [...s.wallets, wallet] })),

    updateWallet: (id: string, updates: Partial<Omit<WalletMeta, "id">>) =>
      set((s) => ({
        wallets: s.wallets.map((v) => (v.id === id ? { ...v, ...updates } : v)),
      })),

    removeWallet: (id: string) =>
      set((s) => {
        const wallets = s.wallets.filter((v) => v.id !== id);
        const activeWalletId =
          s.settings.activeWalletId === id
            ? wallets[0]?.id ?? null
            : s.settings.activeWalletId;
        return { wallets, settings: { ...s.settings, activeWalletId } };
      }),

    setActiveWallet: (id: string | null) =>
      set((s) => ({
        settings: { ...s.settings, activeWalletId: id, activeAccountIndex: 0 },
      })),

    setActiveAccountIndex: (index: number) =>
      set((s) => ({
        settings: { ...s.settings, activeAccountIndex: index },
      })),

    touchWalletUnlocked: (id: string) =>
      set((s) => ({
        wallets: s.wallets.map((v) =>
          v.id === id ? { ...v, lastUnlockedAt: Date.now() } : v
        ),
      })),

    updateSettings: (updates: Partial<AppSettings>) =>
      set((s) => ({ settings: { ...s.settings, ...updates } })),

    addContact: (contact: Contact) =>
      set((s) => ({ contacts: [...s.contacts, contact] })),

    updateContact: (id: string, updates: Partial<Omit<Contact, "id">>) =>
      set((s) => ({
        contacts: s.contacts.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),

    removeContact: (id: string) =>
      set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
  };
}
