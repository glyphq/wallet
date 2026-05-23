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
  /** Last set of vault identities from the most recent unlock — used for balance polling while locked. */
  cachedIdentities: string[];
  pendingRequests: string[];
  isLocked: boolean;
  txAlerts: TxAlert[];
  bobTick: number | null;
  bobConnected: boolean;
  bobSyncLag: number | null;

  unlock: (vaultId: string, seeds: Seed[], wallets: Wallet[]) => void;
  lock: () => void;
  enqueuePendingRequest: (raw: string) => void;
  shiftPendingRequest: () => void;
  addTxAlert: (alert: TxAlert) => void;
  dismissTxAlert: (id: string) => void;
  setBobTick: (tick: number | null, connected: boolean) => void;
  setBobSyncLag: (lag: number | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  unlockedVaultId: null,
  seeds: [],
  wallets: [],
  cachedIdentities: [],
  pendingRequests: [],
  isLocked: true,
  txAlerts: [],
  bobTick: null,
  bobConnected: false,
  bobSyncLag: null,

  unlock: (vaultId, seeds, wallets) => {
    if (seeds.length !== wallets.length) throw new Error("seeds/wallets length mismatch");
    set({ unlockedVaultId: vaultId, seeds, wallets, isLocked: false, cachedIdentities: wallets.map((w) => w.identity) });
  },

  lock: () =>
    set({ unlockedVaultId: null, seeds: [], wallets: [], isLocked: true, pendingRequests: [] }),

  enqueuePendingRequest: (raw) =>
    set((s) => ({ pendingRequests: [...s.pendingRequests, raw] })),

  shiftPendingRequest: () =>
    set((s) => ({ pendingRequests: s.pendingRequests.slice(1) })),

  addTxAlert: (alert) =>
    set((s) => ({ txAlerts: s.txAlerts.some((a) => a.id === alert.id) ? s.txAlerts : [...s.txAlerts, alert] })),

  dismissTxAlert: (id) =>
    set((s) => ({ txAlerts: s.txAlerts.filter((a) => a.id !== id) })),

  setBobTick: (tick, connected) => set({ bobTick: tick, bobConnected: connected }),
  setBobSyncLag: (lag) => set({ bobSyncLag: lag }),
}));
