import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "./persisted-defaults";
import {
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_QUERY_API_URL,
  MAINNET_NETWORK_CONFIG,
  MAINNET_NETWORK_SCOPE,
  resolveNetworkConfig,
} from "@/lib/network-config";
import {
  MAX_NOTIFICATION_EVENTS,
  MAX_TX_MEMOS,
  PERSISTED_STATE_VERSION,
  clampNotificationEvents,
  clampTxMemos,
  mergePersistedState,
  migratePersistedState,
  insertPendingTxForNetwork,
  sanitizeCustomPriceFeedUrl,
  sanitizePollingInterval,
} from "./persisted-boundary";
import type { NotificationEvent, PersistedState } from "./persisted-types";

function currentState(): PersistedState {
  return {
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
    setPasswordLockoutUntil: () => undefined,
    setPasswordAttempts: () => undefined,
    addVault: () => undefined,
    updateVault: () => undefined,
    removeVault: () => undefined,
    setActiveVault: () => undefined,
    setActiveAccountIndex: () => undefined,
    touchVaultUnlocked: () => undefined,
    updateSettings: () => undefined,
    addContact: () => undefined,
    updateContact: () => undefined,
    removeContact: () => undefined,
    addPendingTx: () => undefined,
    removePendingTx: () => undefined,
    approveDapp: () => undefined,
    revokeDapp: () => undefined,
    revokeDappPermission: () => undefined,
    setDappAllowedIdentities: () => undefined,
    setDappPolicy: () => undefined,
    setTxMemo: () => undefined,
    deleteTxMemo: () => undefined,
    addScheduledTransfer: () => undefined,
    updateScheduledTransfer: () => undefined,
    removeScheduledTransfer: () => undefined,
    addNotificationEvent: () => undefined,
    markNotificationEventRead: () => undefined,
    markAllNotificationEventsRead: () => undefined,
    clearNotificationEvents: () => undefined,
    setLastNotificationScanAt: () => undefined,
    addAuditEvent: () => undefined,
    clearAuditEvents: () => undefined,
    addPriceSnapshot: () => undefined,
    addRuntimeIssue: () => undefined,
    clearRuntimeIssues: () => undefined,
    addRequestHistoryItem: () => undefined,
    updateRequestHistoryItem: () => undefined,
    clearRequestHistory: () => undefined,
  };
}

describe("persisted boundary helpers", () => {
  test("clamps transaction memos to the newest insertion window", () => {
    const memos = Object.fromEntries(
      Array.from({ length: MAX_TX_MEMOS + 2 }, (_, index) => [
        `hash-${index}`,
        `memo-${index}`,
      ])
    );

    const clamped = clampTxMemos(memos);

    expect(Object.keys(clamped)).toHaveLength(MAX_TX_MEMOS);
    expect(clamped["hash-0"]).toBeUndefined();
    expect(clamped["hash-1"]).toBeUndefined();
    expect(clamped[`hash-${MAX_TX_MEMOS + 1}`]).toBe(
      `memo-${MAX_TX_MEMOS + 1}`
    );
  });

  test("clamps notification events by newest createdAt", () => {
    const events: NotificationEvent[] = Array.from(
      { length: MAX_NOTIFICATION_EVENTS + 1 },
      (_, index) => ({
        id: `event-${index}`,
        kind: "received",
        title: "title",
        body: "body",
        createdAt: index,
        readAt: null,
      })
    );

    const clamped = clampNotificationEvents(events);

    expect(clamped).toHaveLength(MAX_NOTIFICATION_EVENTS);
    expect(clamped[0]?.id).toBe(`event-${MAX_NOTIFICATION_EVENTS}`);
    expect(clamped.at(-1)?.id).toBe("event-1");
  });

  test("sanitizes polling intervals within persisted bounds", () => {
    expect(sanitizePollingInterval(1_999.4, 10_000)).toBe(2_000);
    expect(sanitizePollingInterval(60_001, 10_000)).toBe(60_000);
    expect(sanitizePollingInterval(12_345.6, 10_000)).toBe(12_346);
    expect(sanitizePollingInterval("fast", 10_000)).toBe(10_000);
  });

  test("sanitizes custom price feed URLs to global HTTPS endpoints", () => {
    expect(sanitizeCustomPriceFeedUrl(" https://price.example/feed ", "")).toBe("https://price.example/feed");
    for (const value of [
      "http://price.example/feed",
      "https://localhost/feed",
      "https://127.0.0.1/feed",
      "https://user:pass@price.example/feed",
      "https://price.example/" + "x".repeat(2049),
    ]) {
      expect(sanitizeCustomPriceFeedUrl(value, "https://safe.example/feed")).toBe("https://safe.example/feed");
    }
  });

  test("merges persisted state with default settings and sanitized boundary fields", () => {
    const approval = {
      origin: "https://app", name: "App", approvedAt: 1, lastUsedAt: 2,
      permissions: ["transfer", "invalid", "transfer"],
      allowedIdentities: ["IDENTITY_A", "IDENTITY_A", 4],
      transferLimitQu: "2,500 qu", expiryDurationMs: 60_000, expiresAt: "bad",
    };
    const memos = Object.fromEntries(Array.from({ length: MAX_TX_MEMOS + 1 }, (_, index) => [`h-${index}`, `m-${index}`]));
    const merged = mergePersistedState(
      {
        passwordAttempts: 4,
        passwordLockoutUntil: 99_000,
        exportSigningKey: { kty: "oct", k: "test-key" },
        settings: {
          approvedDapps: [approval],
          highValueSendThreshold: "1,234 qu",
          priceAlertAbove: "$12.34",
          customPriceFeedUrl: "http://127.0.0.1:8080/latest-stats",
          pollingIntervalActiveMs: 1,
          sponsorAttribution: "invalid",
          allowBlurLockBypass: "yes",
          autoLockMinutes: 0,
          autostartEnabled: true,
        },
        vaults: [
          {
            id: "seeded",
            name: "Seeded",
            color: "sky",
            kind: "seeded",
            createdAt: 1,
            lastUnlockedAt: 2,
            encryptedData: { should: "be removed" },
            accounts: [
              {
                index: 0,
                name: "A",
                addedAt: 1,
                hidden: false,
                tags: ["ok", 1],
              },
            ],
          },
        ],
        txMemosByNetwork: { [MAINNET_NETWORK_SCOPE]: memos },
        approvedDappsByNetwork: { [MAINNET_NETWORK_SCOPE]: [approval] },
      },
      currentState()
    );

    expect(merged.settings.network).toEqual(DEFAULT_SETTINGS.network);
    expect(merged.settings.highValueSendThreshold).toBe("1234");
    expect(merged.settings.priceAlertAbove).toBe("12.34");
    expect(merged.settings.customPriceFeedUrl).toBe(DEFAULT_SETTINGS.customPriceFeedUrl);
    expect(merged.settings.pollingIntervalActiveMs).toBe(2_000);
    expect(merged.settings.sponsorAttribution).toBe(
      DEFAULT_SETTINGS.sponsorAttribution
    );
    expect(merged.settings.allowBlurLockBypass).toBe(true);
    expect(merged.settings.autoLockMinutes).toBe(1);
    expect(merged.settings.autostartEnabled).toBe(true);
    expect(merged.passwordAttempts).toBe(4);
    expect(merged.passwordLockoutUntil).toBe(99_000);
    expect(merged.exportSigningKey).toEqual({ kty: "oct", k: "test-key" });
    expect(merged.settings.approvedDapps[0]).toMatchObject({
      permissions: ["transfer"],
      allowedIdentities: ["IDENTITY_A"],
      transferLimitQu: "2500",
      expiresAt: 60_001,
    });
    expect(merged.vaults[0]?.encryptedData).toEqual({ should: "be removed" });
    expect(merged.vaults[0]?.accounts[0]?.tags).toEqual(["ok"]);
    expect(Object.keys(merged.txMemos)).toHaveLength(MAX_TX_MEMOS);
  });

  test("defaults the startup setting for existing persisted state", () => {
    const merged = mergePersistedState({ settings: {} }, currentState());

    expect(merged.settings.autostartEnabled).toBe(false);
  });

  test("migrates pre-versioned chain records into the mainnet scope", () => {
    const migrated = migratePersistedState(
      {
        settings: {},
        pendingTxs: [
          {
            hash: "legacy-hash",
            source: "SOURCE",
            destination: "DESTINATION",
            amount: "42",
            targetTick: 100,
            broadcastAt: 10,
          },
        ],
        lastNotificationScanAt: 1234,
      },
      0
    ) as Record<string, any>;

    expect(migrated.settings.network).toEqual(MAINNET_NETWORK_CONFIG);
    expect(migrated.pendingTxsByNetwork[MAINNET_NETWORK_SCOPE]).toEqual([
      expect.objectContaining({
        hash: "legacy-hash",
        networkScope: MAINNET_NETWORK_SCOPE,
      }),
    ]);
    expect(migrated.notificationScanAtByNetwork).toEqual({
      [MAINNET_NETWORK_SCOPE]: 1234,
    });
  });

  test("canonicalizes a legacy local endpoint setting without trusting its old name", () => {
    const migrated = migratePersistedState(
      {
        settings: {
          network: {
            name: "custom",
            liveApiUrl: `${LOCAL_TESTNET_LIVE_API_URL}/`,
            queryApiUrl: `${LOCAL_TESTNET_QUERY_API_URL}/`,
          },
        },
      },
      0
    ) as Record<string, any>;

    expect(migrated.settings.network).toMatchObject({
      name: "testnet",
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
    });
  });

  test("keeps legacy chain records on mainnet even when the saved endpoints were custom", () => {
    const migrated = migratePersistedState(
      {
        settings: {
          network: {
            name: "mainnet",
            liveApiUrl: "https://live.example/v1",
            queryApiUrl: "https://query.example/v1",
          },
        },
        pendingTxs: [
          {
            hash: "legacy-custom-setting",
            source: "SOURCE",
            destination: "DESTINATION",
            amount: "1",
            targetTick: 2,
            broadcastAt: 3,
          },
        ],
      },
      0
    ) as Record<string, any>;

    expect(migrated.settings.network.name).toBe("custom");
    expect(migrated.pendingTxsByNetwork[MAINNET_NETWORK_SCOPE][0].networkScope).toBe(
      MAINNET_NETWORK_SCOPE
    );
  });

  test("fails closed for invalid legacy networks and unsupported versions", () => {
    expect(() =>
      migratePersistedState(
        {
          settings: {
            network: {
              name: "mainnet",
              liveApiUrl: "invalid",
              queryApiUrl: "also invalid",
            },
          },
        },
        0
      )
    ).toThrow("valid URLs");
    expect(() => migratePersistedState({}, PERSISTED_STATE_VERSION + 1)).toThrow(
      "Unsupported persisted state version"
    );
    expect(() => migratePersistedState({ settings: "corrupt" }, 0)).toThrow(
      "legacy settings are invalid"
    );
    expect(() =>
      mergePersistedState({ settings: "corrupt" }, currentState())
    ).toThrow("Persisted settings are invalid");
  });

  test("projects pending transactions and notification cursors for only the active scope", () => {
    const local = resolveNetworkConfig({
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
      manifestInstanceId: `qubic-local:${"a".repeat(64)}`,
    });
    const merged = mergePersistedState(
      {
        settings: { network: local },
        pendingTxsByNetwork: {
          [MAINNET_NETWORK_SCOPE]: [
            {
              hash: "mainnet",
              source: "SOURCE",
              destination: "DESTINATION",
              amount: "1",
              targetTick: 2,
              broadcastAt: 3,
            },
          ],
          [local.scope]: [
            {
              hash: "local",
              source: "SOURCE",
              destination: "DESTINATION",
              amount: "4",
              targetTick: 5,
              broadcastAt: 6,
              networkScope: MAINNET_NETWORK_SCOPE,
            },
          ],
        },
        notificationScanAtByNetwork: {
          [MAINNET_NETWORK_SCOPE]: 100,
          [local.scope]: 200,
        },
      },
      currentState()
    );

    expect(merged.settings.network).toEqual(local);
    expect(merged.pendingTxs.map((tx) => tx.hash)).toEqual(["local"]);
    expect(merged.pendingTxs[0]?.networkScope).toBe(local.scope);
    expect(merged.lastNotificationScanAt).toBe(200);
    expect(merged.pendingTxsByNetwork[MAINNET_NETWORK_SCOPE]?.[0]?.hash).toBe(
      "mainnet"
    );
  });

  test("rejects current-version persisted network name or scope divergence", () => {
    expect(() =>
      mergePersistedState(
        {
          settings: {
            network: { ...MAINNET_NETWORK_CONFIG, name: "testnet" },
          },
        },
        currentState()
      )
    ).toThrow("does not match its endpoints");
    expect(() =>
      mergePersistedState(
        {
          settings: {
            network: {
              ...MAINNET_NETWORK_CONFIG,
              scope: "qubic:custom:forged",
            },
          },
        },
        currentState()
      )
    ).toThrow("does not match its endpoints");
  });

  test("migrates every legacy authorization or chain-derived record to mainnet", () => {
    const migrated = migratePersistedState({
      settings: { approvedDapps: [{ origin: "https://app", name: "App", approvedAt: 1, permissions: ["transfer"] }] },
      txMemos: { hash: "memo" },
      txTags: { hash: ["tax", 4] },
      priceSnapshots: [{ timestamp: 4, priceUsd: 2.5 }],
      scheduledTransfers: [{ id: "schedule" }],
      notificationEvents: [{ id: "notice", kind: "received", title: "T", body: "B", createdAt: 2, readAt: null }],
      requestHistory: [{ id: "request", createdAt: 3, type: "connect", dappName: "App", dappOrigin: "https://app", action: "approved", callbackStatus: "none" }],
    }, 1) as Record<string, any>;

    expect(migrated.txMemosByNetwork).toEqual({ [MAINNET_NETWORK_SCOPE]: { hash: "memo" } });
    expect(migrated.txTagsByNetwork).toEqual({ [MAINNET_NETWORK_SCOPE]: { hash: ["tax"] } });
    expect(migrated.priceSnapshotsByNetwork).toEqual({ [MAINNET_NETWORK_SCOPE]: [{ timestamp: 4, priceUsd: 2.5 }] });
    for (const field of ["scheduledTransfersByNetwork", "notificationEventsByNetwork", "requestHistoryByNetwork", "approvedDappsByNetwork"]) {
      expect(migrated[field][MAINNET_NETWORK_SCOPE][0].networkScope).toBe(MAINNET_NETWORK_SCOPE);
    }
  });

  test("projects only the active scope and rejects unknown scope keys", () => {
    const local = resolveNetworkConfig({
      liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
      queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
      manifestInstanceId: `qubic-local:${"a".repeat(64)}`,
    });
    const makeDapp = (origin: string) => ({ origin, name: origin, approvedAt: 1, permissions: ["transfer"] });
    const merged = mergePersistedState({
      settings: { network: local },
      txMemosByNetwork: { mainnet: { shared: "mainnet" }, [local.scope]: { shared: "local" }, evil: { shared: "evil" } },
      txTagsByNetwork: { [MAINNET_NETWORK_SCOPE]: { shared: ["mainnet"] }, [local.scope]: { shared: ["local"] } },
      scheduledTransfersByNetwork: { mainnet: [{ id: "main" }], [local.scope]: [{ id: "local", networkScope: "mainnet" }] },
      notificationEventsByNetwork: { mainnet: [{ id: "main", kind: "system", title: "M", body: "M", createdAt: 1 }], [local.scope]: [{ id: "local", kind: "received", title: "L", body: "L", createdAt: 2 }] },
      requestHistoryByNetwork: { mainnet: [{ id: "main", createdAt: 1, type: "connect", dappName: "M", dappOrigin: "https://same", action: "approved", callbackStatus: "none" }], [local.scope]: [{ id: "local", createdAt: 2, type: "connect", dappName: "L", dappOrigin: "https://same", action: "approved", callbackStatus: "none" }] },
      approvedDappsByNetwork: { mainnet: [makeDapp("https://same")], [local.scope]: [makeDapp("https://same")] },
      priceSnapshotsByNetwork: { [MAINNET_NETWORK_SCOPE]: [{ timestamp: 1, priceUsd: 99 }], [local.scope]: [{ timestamp: 2, priceUsd: 0 }] },
    }, currentState());

    expect(merged.txMemos).toEqual({ shared: "local" });
    expect(merged.txTags).toEqual({ shared: ["local"] });
    expect(merged.priceSnapshots).toEqual([{ timestamp: 2, priceUsd: 0 }]);
    expect(merged.scheduledTransfers.map((item) => item.id)).toEqual(["local"]);
    expect(merged.scheduledTransfers[0]?.networkScope).toBe(local.scope);
    expect(merged.notificationEvents.map((item) => item.id)).toEqual(["local"]);
    expect(merged.requestHistory.map((item) => item.id)).toEqual(["local"]);
    expect(merged.settings.approvedDapps).toHaveLength(1);
    expect(merged.settings.approvedDapps[0]?.networkScope).toBe(local.scope);
    expect((merged.txMemosByNetwork as Record<string, unknown>).evil).toBeUndefined();
  });

  test("keeps contacts global while isolating chain-derived records", () => {
    const contact = { id: "contact", name: "Alice", identity: "IDENTITY", note: "", addedAt: 1, lastUsedAt: 1 };
    const merged = mergePersistedState({ contacts: [contact], txMemosByNetwork: { [MAINNET_NETWORK_SCOPE]: { hash: "memo" } } }, currentState());
    expect(merged.contacts).toEqual([contact]);
    expect(merged.txMemos).toEqual({ hash: "memo" });
  });

  test("files a completed broadcast under its captured scope after an active-network switch", () => {
    const localScope = `local:${"a".repeat(64)}` as const;
    const inserted = insertPendingTxForNetwork({}, {
      hash: "local-hash", source: "A", destination: "B", amount: "1",
      targetTick: 10, broadcastAt: 20,
    }, localScope);
    expect(inserted.pendingTxs[0]?.networkScope).toBe(localScope);
    expect(inserted.pendingTxsByNetwork[localScope]?.[0]?.hash).toBe("local-hash");
    expect(inserted.pendingTxsByNetwork[MAINNET_NETWORK_SCOPE]).toBeUndefined();
  });
});
