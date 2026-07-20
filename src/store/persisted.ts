import { LazyStore } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { DEFAULT_SETTINGS } from "./persisted-defaults";
import {
  MAX_PENDING_TXS,
  MAX_SCHEDULED_TRANSFERS,
  clampAuditEvents,
  clampNotificationEvents,
  clampPriceSnapshots,
  clampRequestHistory,
  clampRuntimeIssues,
  clampTxMemos,
  mergePersistedState,
} from "./persisted-boundary";
import type { PersistedState } from "./persisted-types";
export type {
  AccountMeta,
  AccentColorId,
  AppSettings,
  ApprovedDapp,
  AuditEvent,
  AuditEventKind,
  Contact,
  FontPairId,
  NetworkConfig,
  NotificationEvent,
  NotificationEventKind,
  PendingTx,
  PriceSnapshot,
  RequestHistoryAction,
  RequestHistoryCallbackStatus,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
  VaultColor,
  WalletIconId,
  VaultMeta,
} from "./persisted-types";

const _disk = new LazyStore("glyph.json");

const tauriStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const raw = await _disk.get<string>(name);
      if (raw == null) return null;
      return await invoke<string>("decrypt_store_value", { value: raw });
    } catch (err) {
      console.error("[glyph] disk read failed:", err);
      window.dispatchEvent(new CustomEvent("glyph:disk-read-error"));
      throw err;
    }
  },
  setItem: async (name, value) => {
    let encrypted: string;
    try {
      encrypted = await invoke<string>("encrypt_store_value", { value });
    } catch (err) {
      console.error("[glyph] encrypt_store_value failed:", err);
      window.dispatchEvent(new CustomEvent("glyph:disk-write-error"));
      return;
    }
    try {
      await _disk.set(name, encrypted);
      await _disk.save();
    } catch (err) {
      console.error("[glyph] disk write failed, retrying once:", err);
      try {
        await _disk.set(name, encrypted);
        await _disk.save();
      } catch (err2) {
        console.error(
          "[glyph] disk write failed permanently — data may be lost on restart:",
          err2
        );
        window.dispatchEvent(new CustomEvent("glyph:disk-write-error"));
      }
    }
  },
  removeItem: async (name) => {
    try {
      await _disk.delete(name);
      await _disk.save();
    } catch {}
  },
};

/** Zustand store backed by Tauri LazyStore (`glyph.json` on disk). Survives app restarts. */
export const usePersistedStore = create<PersistedState>()(
  persist(
    (set) => ({
      vaults: [],
      settings: DEFAULT_SETTINGS,
      contacts: [],
      pendingTxs: [],
      txMemos: {},
      txTags: {},
      scheduledTransfers: [],
      notificationEvents: [],
      priceSnapshots: [],
      runtimeIssues: [],
      auditEvents: [],
      requestHistory: [],
      lastNotificationScanAt: 0,
      passwordLockoutUntil: 0,
      passwordAttempts: 0,
      exportSigningKey: null,

      setPasswordLockoutUntil: (until) => set({ passwordLockoutUntil: until }),
      setPasswordAttempts: (n) => set({ passwordAttempts: n }),

      addVault: (vault) => set((s) => ({ vaults: [...s.vaults, vault] })),

      updateVault: (id, updates) =>
        set((s) => ({
          vaults: s.vaults.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),

      removeVault: (id) =>
        set((s) => {
          const vaults = s.vaults.filter((v) => v.id !== id);
          const activeVaultId =
            s.settings.activeVaultId === id
              ? vaults[0]?.id ?? null
              : s.settings.activeVaultId;
          return { vaults, settings: { ...s.settings, activeVaultId } };
        }),

      setActiveVault: (id) =>
        set((s) => ({
          settings: { ...s.settings, activeVaultId: id, activeAccountIndex: 0 },
        })),

      setActiveAccountIndex: (index) =>
        set((s) => ({
          settings: { ...s.settings, activeAccountIndex: index },
        })),

      touchVaultUnlocked: (id) =>
        set((s) => ({
          vaults: s.vaults.map((v) =>
            v.id === id ? { ...v, lastUnlockedAt: Date.now() } : v
          ),
        })),

      updateSettings: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),

      addContact: (contact) =>
        set((s) => ({ contacts: [...s.contacts, contact] })),

      updateContact: (id, updates) =>
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      removeContact: (id) =>
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),

      addPendingTx: (tx) =>
        set((s) => ({
          pendingTxs: [tx, ...s.pendingTxs].slice(0, MAX_PENDING_TXS),
        })),

      removePendingTx: (hash) =>
        set((s) => ({
          pendingTxs: s.pendingTxs.filter((t) => t.hash !== hash),
        })),

      approveDapp: (dapp) =>
        set((s) => {
          const now = Date.now();
          const existing = s.settings.approvedDapps.find(
            (d) => d.origin === dapp.origin
          );
          const approvedDapps = existing
            ? s.settings.approvedDapps.map((d) =>
                d.origin === dapp.origin
                  ? (() => {
                      const allowedIdentities =
                        d.allowedIdentities === undefined ||
                        dapp.allowedIdentities === undefined
                          ? d.allowedIdentities ?? dapp.allowedIdentities
                          : [...new Set([...d.allowedIdentities, ...dapp.allowedIdentities])];
                      return {
                        ...d,
                        name: dapp.name,
                        approvedAt: dapp.approvedAt,
                        lastUsedAt: now,
                        permissions: [
                          ...new Set([...d.permissions, ...dapp.permissions]),
                        ],
                        allowedIdentities,
                      };
                    })()
                  : d
              )
            : [...s.settings.approvedDapps, { ...dapp, lastUsedAt: now }];
          return { settings: { ...s.settings, approvedDapps } };
        }),

      revokeDapp: (origin) =>
        set((s) => ({
          settings: {
            ...s.settings,
            approvedDapps: s.settings.approvedDapps.filter(
              (d) => d.origin !== origin
            ),
          },
        })),

      revokeDappPermission: (origin, permission) =>
        set((s) => {
          const approvedDapps = s.settings.approvedDapps
            .map((d) =>
              d.origin === origin
                ? {
                    ...d,
                    permissions: d.permissions.filter((p) => p !== permission),
                  }
                : d
            );
          return { settings: { ...s.settings, approvedDapps } };
        }),

      setDappAllowedIdentities: (origin, identities) =>
        set((s) => ({
          settings: {
            ...s.settings,
            approvedDapps: s.settings.approvedDapps.map((d) =>
              d.origin === origin ? { ...d, allowedIdentities: identities } : d
            ),
          },
        })),

      setTxMemo: (hash, memo) =>
        set((s) => ({ txMemos: clampTxMemos({ ...s.txMemos, [hash]: memo }) })),

      deleteTxMemo: (hash) =>
        set((s) => {
          const next = { ...s.txMemos };
          delete next[hash];
          return { txMemos: next };
        }),

      addScheduledTransfer: (transfer) =>
        set((s) => ({
          scheduledTransfers: [transfer, ...s.scheduledTransfers].slice(
            0,
            MAX_SCHEDULED_TRANSFERS
          ),
        })),

      updateScheduledTransfer: (id, updates) =>
        set((s) => ({
          scheduledTransfers: s.scheduledTransfers.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      removeScheduledTransfer: (id) =>
        set((s) => ({
          scheduledTransfers: s.scheduledTransfers.filter((t) => t.id !== id),
        })),

      addNotificationEvent: (event) =>
        set((s) => {
          if (
            event.dedupeKey &&
            s.notificationEvents.some(
              (existing) => existing.dedupeKey === event.dedupeKey
            )
          ) {
            return s;
          }
          return {
            notificationEvents: clampNotificationEvents([
              event,
              ...s.notificationEvents,
            ]),
          };
        }),

      markNotificationEventRead: (id) =>
        set((s) => ({
          notificationEvents: s.notificationEvents.map((event) =>
            event.id === id && event.readAt === null
              ? { ...event, readAt: Date.now() }
              : event
          ),
        })),

      markAllNotificationEventsRead: () =>
        set((s) => ({
          notificationEvents: s.notificationEvents.map((event) =>
            event.readAt === null ? { ...event, readAt: Date.now() } : event
          ),
        })),

      clearNotificationEvents: () => set({ notificationEvents: [] }),

      setLastNotificationScanAt: (timestamp) =>
        set({ lastNotificationScanAt: timestamp }),

      addAuditEvent: (event) =>
        set((s) => ({
          auditEvents: clampAuditEvents([event, ...s.auditEvents]),
        })),

      clearAuditEvents: () => set({ auditEvents: [] }),

      addPriceSnapshot: (snapshot) =>
        set((s) => {
          const latest = s.priceSnapshots[0];
          const priceFraction =
            latest && latest.priceUsd > 0
              ? Math.abs(latest.priceUsd - snapshot.priceUsd) / latest.priceUsd
              : Infinity;
          if (
            latest &&
            priceFraction < 0.001 &&
            snapshot.timestamp - latest.timestamp < 15 * 60 * 1000
          ) {
            return s;
          }
          return {
            priceSnapshots: clampPriceSnapshots([
              snapshot,
              ...s.priceSnapshots,
            ]),
          };
        }),

      addRuntimeIssue: (issue) =>
        set((s) => ({
          runtimeIssues: clampRuntimeIssues([issue, ...s.runtimeIssues]),
        })),

      clearRuntimeIssues: () => set({ runtimeIssues: [] }),

      addRequestHistoryItem: (event) =>
        set((s) => ({
          requestHistory: clampRequestHistory([event, ...s.requestHistory]),
        })),

      updateRequestHistoryItem: (id, updates) =>
        set((s) => ({
          requestHistory: clampRequestHistory(
            s.requestHistory.map((event) =>
              event.id === id ? { ...event, ...updates } : event
            )
          ),
        })),

      clearRequestHistory: () => set({ requestHistory: [] }),
    }),
    {
      name: "glyph-persisted",
      storage: createJSONStorage(() => tauriStorage),
      // Deep-merge settings so new fields added to DEFAULT_SETTINGS survive rehydration.
      // Validate array fields so corrupted JSON cannot replace typed arrays with scalars.
      merge: mergePersistedState,
    }
  )
);
