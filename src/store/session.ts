import { create } from "zustand";
import type { Seed } from "@qubic.org/types";
import type { Wallet } from "@qubic.org/wallet";

export interface TxAlert {
  id: string;
  label: string;
  reason: "expired" | "failed";
}

interface SessionState {
  unlockedVaultId: string | null;
  seeds: Seed[];
  wallets: Wallet[];
  pendingRequest: string | null;
  isLocked: boolean;
  txAlerts: TxAlert[];

  unlock: (vaultId: string, seeds: Seed[], wallets: Wallet[]) => void;
  lock: () => void;
  setPendingRequest: (raw: string | null) => void;
  addTxAlert: (alert: TxAlert) => void;
  dismissTxAlert: (id: string) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  unlockedVaultId: null,
  seeds: [],
  wallets: [],
  pendingRequest: null,
  isLocked: true,
  txAlerts: [],

  unlock: (vaultId, seeds, wallets) => {
    if (seeds.length !== wallets.length) throw new Error("seeds/wallets length mismatch");
    set({ unlockedVaultId: vaultId, seeds, wallets, isLocked: false });
  },

  lock: () =>
    set({ unlockedVaultId: null, seeds: [], wallets: [], isLocked: true, pendingRequest: null }),

  setPendingRequest: (raw) => set({ pendingRequest: raw }),

  addTxAlert: (alert) =>
    set((s) => ({ txAlerts: s.txAlerts.some((a) => a.id === alert.id) ? s.txAlerts : [...s.txAlerts, alert] })),

  dismissTxAlert: (id) =>
    set((s) => ({ txAlerts: s.txAlerts.filter((a) => a.id !== id) })),
}));
