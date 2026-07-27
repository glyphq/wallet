import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "./persisted-defaults";
import {
  MAX_NOTIFICATION_EVENTS,
  MAX_TX_MEMOS,
  clampNotificationEvents,
  clampTxMemos,
  mergePersistedState,
  sanitizePollingInterval,
} from "./persisted-boundary";
import type { NotificationEvent, PersistedState } from "./persisted-types";

function currentState(): PersistedState {
  return {
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

  test("merges persisted state with default settings and sanitized boundary fields", () => {
    const merged = mergePersistedState(
      {
        settings: {
          approvedDapps: [
            {
              origin: "https://app",
              name: "App",
              approvedAt: 1,
              permissions: ["transfer"],
            },
          ],
          highValueSendThreshold: "1,234 qu",
          priceAlertAbove: "$12.34",
          pollingIntervalActiveMs: 1,
          sponsorAttribution: "invalid",
          allowBlurLockBypass: "yes",
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
        txMemos: Object.fromEntries(
          Array.from({ length: MAX_TX_MEMOS + 1 }, (_, index) => [
            `h-${index}`,
            `m-${index}`,
          ])
        ),
      },
      currentState()
    );

    expect(merged.settings.network).toEqual(DEFAULT_SETTINGS.network);
    expect(merged.settings.highValueSendThreshold).toBe("1234");
    expect(merged.settings.priceAlertAbove).toBe("12.34");
    expect(merged.settings.pollingIntervalActiveMs).toBe(2_000);
    expect(merged.settings.sponsorAttribution).toBe(
      DEFAULT_SETTINGS.sponsorAttribution
    );
    expect(merged.settings.allowBlurLockBypass).toBe(true);
    expect(merged.vaults[0]?.encryptedData).toEqual({ should: "be removed" });
    expect(merged.vaults[0]?.accounts[0]?.tags).toEqual(["ok"]);
    expect(Object.keys(merged.txMemos)).toHaveLength(MAX_TX_MEMOS);
  });
});
