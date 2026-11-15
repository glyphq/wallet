import type { PersistedStoreSet } from "./persisted-store-set";
import type { AppSettings, Contact, VaultMeta } from "./persisted-types";

/** Vault, settings, lockout and contact actions for the persisted store. */
export function createVaultActions(set: PersistedStoreSet) {
  return {
    setPasswordLockoutUntil: (until: number) => set({ passwordLockoutUntil: until }),
    setPasswordAttempts: (n: number) => set({ passwordAttempts: n }),

    addVault: (vault: VaultMeta) => set((s) => ({ vaults: [...s.vaults, vault] })),

    updateVault: (id: string, updates: Partial<Omit<VaultMeta, "id">>) =>
      set((s) => ({
        vaults: s.vaults.map((v) => (v.id === id ? { ...v, ...updates } : v)),
      })),

    removeVault: (id: string) =>
      set((s) => {
        const vaults = s.vaults.filter((v) => v.id !== id);
        const activeVaultId =
          s.settings.activeVaultId === id
            ? vaults[0]?.id ?? null
            : s.settings.activeVaultId;
        return { vaults, settings: { ...s.settings, activeVaultId } };
      }),

    setActiveVault: (id: string | null) =>
      set((s) => ({
        settings: { ...s.settings, activeVaultId: id, activeAccountIndex: 0 },
      })),

    setActiveAccountIndex: (index: number) =>
      set((s) => ({
        settings: { ...s.settings, activeAccountIndex: index },
      })),

    touchVaultUnlocked: (id: string) =>
      set((s) => ({
        vaults: s.vaults.map((v) =>
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
