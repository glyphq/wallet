import { LazyStore } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { DEFAULT_SETTINGS } from "./persisted-defaults";
import {
  MAX_SCHEDULED_TRANSFERS,
  clampAuditEvents,
  clampRequestHistory,
  clampRuntimeIssues,
  clampTxMemos,
  mergePersistedState,
  migratePersistedState,
  insertPendingTxForNetwork,
  removePendingTxForNetwork,
  insertNotificationEventForNetwork,
  insertPriceSnapshotForNetwork,
  setNotificationScanForNetwork,
  PERSISTED_STATE_VERSION,
} from "./persisted-boundary";
import type { PersistedState } from "./persisted-types";
import { sanitizeDappExpiresAt, sanitizeDappExpiryDurationMs, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";
import { resolveNetworkConfig } from "@/lib/network-config";
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
  NetworkScope,
  NotificationEvent,
  NotificationEventKind,
  PendingTx,
  PendingTxInput,
  PriceSnapshot,
  RequestHistoryAction,
  RequestHistoryCallbackStatus,
  RequestHistoryItem,
  RuntimeIssue,
  ScheduledTransfer,
  ThemeMode,
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
      pendingTxsByNetwork: {},
      txMemos: {},
      txMemosByNetwork: {},
      txTags: {},
      txTagsByNetwork: {},
      scheduledTransfers: [],
      scheduledTransfersByNetwork: {},
      notificationEvents: [],
      notificationEventsByNetwork: {},
      priceSnapshots: [],
      priceSnapshotsByNetwork: {},
      runtimeIssues: [],
      auditEvents: [],
      requestHistory: [],
      requestHistoryByNetwork: {},
      approvedDappsByNetwork: {},
      lastNotificationScanAt: 0,
      notificationScanAtByNetwork: {},
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
        set((s) => {
          if (!updates.network) {
            return {
              settings: {
                ...s.settings,
                ...updates,
                network: s.settings.network,
                approvedDapps: s.settings.approvedDapps,
              },
            };
          }
          const network = resolveNetworkConfig({
            liveApiUrl: updates.network.liveApiUrl,
            queryApiUrl: updates.network.queryApiUrl,
            manifestInstanceId: updates.network.manifestInstanceId,
          });
          return {
            pendingTxs: s.pendingTxsByNetwork[network.scope] ?? [],
            txMemos: s.txMemosByNetwork[network.scope] ?? {},
            txTags: s.txTagsByNetwork[network.scope] ?? {},
            scheduledTransfers: s.scheduledTransfersByNetwork[network.scope] ?? [],
            notificationEvents: s.notificationEventsByNetwork[network.scope] ?? [],
            priceSnapshots: s.priceSnapshotsByNetwork[network.scope] ?? [],
            requestHistory: s.requestHistoryByNetwork[network.scope] ?? [],
            approvedDappsByNetwork: s.approvedDappsByNetwork,
            settings: {
              ...s.settings,
              ...updates,
              network,
              approvedDapps: s.approvedDappsByNetwork[network.scope] ?? [],
            },
            lastNotificationScanAt:
              s.notificationScanAtByNetwork[network.scope] ?? 0,
          };
        }),

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

      addPendingTx: (tx, expectedScope) =>
        set((s) => {
          const inserted = insertPendingTxForNetwork(s.pendingTxsByNetwork, tx, expectedScope);
          return s.settings.network.scope === expectedScope
            ? inserted
            : { pendingTxsByNetwork: inserted.pendingTxsByNetwork };
        }),

      removePendingTx: (hash, expectedScope) =>
        set((s) => {
          const removed = removePendingTxForNetwork(s.pendingTxsByNetwork, hash, expectedScope);
          return s.settings.network.scope === expectedScope
            ? removed
            : { pendingTxsByNetwork: removed.pendingTxsByNetwork };
        }),

      approveDapp: (dapp, expectedScope) =>
        set((s) => {
          const scope = expectedScope;
          const now = Date.now();
          const activeDapps = s.approvedDappsByNetwork[scope] ?? [];
          const existing = activeDapps.find(
            (d) => d.origin === dapp.origin
          );
          const transferLimitQu = sanitizeTransferLimitQu(dapp.transferLimitQu);
          const expiryDurationMs = sanitizeDappExpiryDurationMs(dapp.expiryDurationMs);
          const expiresAt = sanitizeDappExpiresAt(dapp.expiresAt);
          const approvedDapps = existing
            ? activeDapps.map((d) =>
                d.origin === dapp.origin
                  ? (() => {
                      const allowedIdentities =
                        d.allowedIdentities === undefined ||
                        dapp.allowedIdentities === undefined
                          ? d.allowedIdentities
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
                        transferLimitQu,
                        expiryDurationMs,
                        expiresAt,
                      };
                    })()
                  : d
              )
            : [...activeDapps, { ...dapp, networkScope: scope, transferLimitQu, expiryDurationMs, expiresAt, lastUsedAt: now }];
          const approvedDappsByNetwork = { ...s.approvedDappsByNetwork, [scope]: approvedDapps };
          return s.settings.network.scope === scope
            ? { settings: { ...s.settings, approvedDapps }, approvedDappsByNetwork }
            : { approvedDappsByNetwork };
        }),

      revokeDapp: (origin) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const approvedDapps = (s.approvedDappsByNetwork[scope] ?? []).filter((d) => d.origin !== origin);
          return { settings: { ...s.settings, approvedDapps }, approvedDappsByNetwork: { ...s.approvedDappsByNetwork, [scope]: approvedDapps } };
        }),

      revokeDappPermission: (origin, permission) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const approvedDapps = (s.approvedDappsByNetwork[scope] ?? [])
            .map((d) =>
              d.origin === origin
                ? {
                    ...d,
                    permissions: d.permissions.filter((p) => p !== permission),
                  }
                : d
            );
          return { settings: { ...s.settings, approvedDapps }, approvedDappsByNetwork: { ...s.approvedDappsByNetwork, [scope]: approvedDapps } };
        }),

      setDappAllowedIdentities: (origin, identities) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const approvedDapps = (s.approvedDappsByNetwork[scope] ?? []).map((d) => d.origin === origin ? { ...d, allowedIdentities: identities } : d);
          return { settings: { ...s.settings, approvedDapps }, approvedDappsByNetwork: { ...s.approvedDappsByNetwork, [scope]: approvedDapps } };
        }),

      setDappPolicy: (origin, policy) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const approvedDapps = (s.approvedDappsByNetwork[scope] ?? []).map((d) =>
              d.origin === origin
                ? {
                    ...d,
                    transferLimitQu: sanitizeTransferLimitQu(policy.transferLimitQu),
                    expiryDurationMs: sanitizeDappExpiryDurationMs(policy.expiryDurationMs),
                    expiresAt: sanitizeDappExpiresAt(policy.expiresAt),
                  }
                : d
            );
          return { settings: { ...s.settings, approvedDapps }, approvedDappsByNetwork: { ...s.approvedDappsByNetwork, [scope]: approvedDapps } };
        }),

      setTxMemo: (hash, memo) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const txMemos = clampTxMemos({ ...(s.txMemosByNetwork[scope] ?? {}), [hash]: memo });
          return { txMemos, txMemosByNetwork: { ...s.txMemosByNetwork, [scope]: txMemos } };
        }),

      deleteTxMemo: (hash) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const next = { ...(s.txMemosByNetwork[scope] ?? {}) };
          delete next[hash];
          return { txMemos: next, txMemosByNetwork: { ...s.txMemosByNetwork, [scope]: next } };
        }),

      addScheduledTransfer: (transfer) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const scheduledTransfers = [{ ...transfer, networkScope: scope }, ...(s.scheduledTransfersByNetwork[scope] ?? [])].slice(0, MAX_SCHEDULED_TRANSFERS);
          return { scheduledTransfers, scheduledTransfersByNetwork: { ...s.scheduledTransfersByNetwork, [scope]: scheduledTransfers } };
        }),

      updateScheduledTransfer: (id, updates) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const scheduledTransfers = (s.scheduledTransfersByNetwork[scope] ?? []).map((t) =>
            t.id === id ? { ...t, ...updates } : t
          );
          return { scheduledTransfers, scheduledTransfersByNetwork: { ...s.scheduledTransfersByNetwork, [scope]: scheduledTransfers } };
        }),

      removeScheduledTransfer: (id) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const scheduledTransfers = (s.scheduledTransfersByNetwork[scope] ?? []).filter((t) => t.id !== id);
          return { scheduledTransfers, scheduledTransfersByNetwork: { ...s.scheduledTransfersByNetwork, [scope]: scheduledTransfers } };
        }),

      addNotificationEvent: (event, expectedScope) =>
        set((s) => {
          const notificationEventsByNetwork = insertNotificationEventForNetwork(s.notificationEventsByNetwork, event, expectedScope);
          return s.settings.network.scope === expectedScope
            ? { notificationEvents: notificationEventsByNetwork[expectedScope] ?? [], notificationEventsByNetwork }
            : { notificationEventsByNetwork };
        }),

      markNotificationEventRead: (id) =>
        set((s) => {
          const scope = s.settings.network.scope;
          const notificationEvents = (s.notificationEventsByNetwork[scope] ?? []).map((event) =>
            event.id === id && event.readAt === null
              ? { ...event, readAt: Date.now() }
              : event
          );
          return { notificationEvents, notificationEventsByNetwork: { ...s.notificationEventsByNetwork, [scope]: notificationEvents } };
        }),

      markAllNotificationEventsRead: () =>
        set((s) => {
          const scope = s.settings.network.scope;
          const notificationEvents = (s.notificationEventsByNetwork[scope] ?? []).map((event) =>
            event.readAt === null ? { ...event, readAt: Date.now() } : event
          );
          return { notificationEvents, notificationEventsByNetwork: { ...s.notificationEventsByNetwork, [scope]: notificationEvents } };
        }),

      clearNotificationEvents: () => set((s) => ({ notificationEvents: [], notificationEventsByNetwork: { ...s.notificationEventsByNetwork, [s.settings.network.scope]: [] } })),

      setLastNotificationScanAt: (timestamp, expectedScope) =>
        set((s) => {
          const notificationScanAtByNetwork = setNotificationScanForNetwork(s.notificationScanAtByNetwork, timestamp, expectedScope);
          return s.settings.network.scope === expectedScope
            ? { lastNotificationScanAt: timestamp, notificationScanAtByNetwork }
            : { notificationScanAtByNetwork };
        }),

      addAuditEvent: (event) =>
        set((s) => ({
          auditEvents: clampAuditEvents([event, ...s.auditEvents]),
        })),

      clearAuditEvents: () => set({ auditEvents: [] }),

      addPriceSnapshot: (snapshot, expectedScope) =>
        set((s) => {
          const priceSnapshotsByNetwork = insertPriceSnapshotForNetwork(s.priceSnapshotsByNetwork, snapshot, expectedScope);
          return s.settings.network.scope === expectedScope
            ? { priceSnapshots: priceSnapshotsByNetwork[expectedScope] ?? [], priceSnapshotsByNetwork }
            : { priceSnapshotsByNetwork };
        }),

      addRuntimeIssue: (issue) =>
        set((s) => ({
          runtimeIssues: clampRuntimeIssues([issue, ...s.runtimeIssues]),
        })),

      clearRuntimeIssues: () => set({ runtimeIssues: [] }),

      addRequestHistoryItem: (event, expectedScope) =>
        set((s) => {
          const scope = expectedScope;
          const requestHistory = clampRequestHistory([{ ...event, networkScope: scope }, ...(s.requestHistoryByNetwork[scope] ?? [])]);
          const requestHistoryByNetwork = { ...s.requestHistoryByNetwork, [scope]: requestHistory };
          return s.settings.network.scope === scope
            ? { requestHistory, requestHistoryByNetwork }
            : { requestHistoryByNetwork };
        }),

      updateRequestHistoryItem: (id, updates, expectedScope) =>
        set((s) => {
          const scope = expectedScope;
          const requestHistory = clampRequestHistory(
            (s.requestHistoryByNetwork[scope] ?? []).map((event) =>
              event.id === id ? { ...event, ...updates } : event
            )
          );
          const requestHistoryByNetwork = { ...s.requestHistoryByNetwork, [scope]: requestHistory };
          return s.settings.network.scope === scope
            ? { requestHistory, requestHistoryByNetwork }
            : { requestHistoryByNetwork };
        }),

      clearRequestHistory: () => set((s) => ({ requestHistory: [], requestHistoryByNetwork: { ...s.requestHistoryByNetwork, [s.settings.network.scope]: [] } })),
    }),
    {
      name: "glyph-persisted",
      storage: createJSONStorage(() => tauriStorage),
      version: PERSISTED_STATE_VERSION,
      migrate: migratePersistedState,
      // Deep-merge settings so new fields added to DEFAULT_SETTINGS survive rehydration.
      // Validate array fields so corrupted JSON cannot replace typed arrays with scalars.
      merge: mergePersistedState,
    }
  )
);
