import { create } from "zustand";
import { clearSecureSession } from "@/lib/secure-session";
import type { SessionAccount } from "@/lib/session-account";

export const MAX_PENDING_REQUESTS = 20;

export interface TxAlert {
  id: string;
  label: string;
  reason: "expired" | "failed";
}

export interface TxDraft {
  destination: string;
  amountStr: string;
  savedAt: number;
}

interface SessionState {
  unlockedWalletId: string | null;
  accounts: SessionAccount[];
  /** Last set of wallet identities from the most recent unlock — used for balance polling while locked. */
  cachedIdentities: string[];
  pendingRequests: string[];
  isLocked: boolean;
  txAlerts: TxAlert[];
  txDraft: TxDraft | null;

  unlock: (
    walletId: string,
    accounts: SessionAccount[],
    options?: { identities?: string[] },
  ) => void;
  lock: () => void;
  resetForSetup: () => void;
  enqueuePendingRequest: (raw: string) => void;
  shiftPendingRequest: () => void;
  addTxAlert: (alert: TxAlert) => void;
  dismissTxAlert: (id: string) => void;
  saveTxDraft: (draft: TxDraft) => void;
  clearTxDraft: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  unlockedWalletId: null,
  accounts: [],
  cachedIdentities: [],
  pendingRequests: [],
  isLocked: true,
  txAlerts: [],
  txDraft: null,

  unlock: (walletId, accounts, options) => {
    set({
      unlockedWalletId: walletId,
      accounts,
      isLocked: false,
      cachedIdentities: options?.identities ?? accounts.map((account) => account.identity),
    });
  },

  lock: () => {
    clearSecureSession();
    set({ unlockedWalletId: null, accounts: [], isLocked: true, txAlerts: [], txDraft: null });
  },

  resetForSetup: () => {
    clearSecureSession();
    set({
      unlockedWalletId: null,
      accounts: [],
      cachedIdentities: [],
      isLocked: true,
      txAlerts: [],
      txDraft: null,
    });
  },

  enqueuePendingRequest: (raw) =>
    set((s) => {
      // The native queue is the authority for new links, but keep this second
      // boundary in case the same Tauri event is delivered more than once.
      // Keep the oldest requests at capacity so an already-visible request can
      // never be displaced by a later link.
      if (s.pendingRequests.includes(raw) || s.pendingRequests.length >= MAX_PENDING_REQUESTS) {
        return s;
      }
      return { pendingRequests: [...s.pendingRequests, raw] };
    }),

  shiftPendingRequest: () =>
    set((s) => ({ pendingRequests: s.pendingRequests.slice(1) })),

  addTxAlert: (alert) =>
    set((s) => ({ txAlerts: s.txAlerts.some((a) => a.id === alert.id) ? s.txAlerts : [...s.txAlerts, alert] })),

  dismissTxAlert: (id) =>
    set((s) => ({ txAlerts: s.txAlerts.filter((a) => a.id !== id) })),

  saveTxDraft: (draft) => set({ txDraft: draft }),
  clearTxDraft: () => set({ txDraft: null }),
}));
