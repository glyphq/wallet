import { describe, expect, test } from "bun:test";
import { approveRequest, buildRedirectUrl, deliverRequestResult, rejectRequest, type RequestOrchestrationDeps } from "@/lib/request-orchestration";
import type { GlyphEnvelope } from "@/lib/request-schema";
import type { RequestHistoryItem } from "@/store/persisted";

function makeDeps(overrides: Partial<RequestOrchestrationDeps> = {}) {
  const added: RequestHistoryItem[] = [];
  const updates: Array<{ id: string; patch: Partial<RequestHistoryItem> }> = [];
  const audits: unknown[] = [];
  const posts: Array<{ url: string; body: string }> = [];
  const opened: string[] = [];
  const deps: RequestOrchestrationDeps = {
    now: () => 1234,
    makeRequestHistoryId: () => "req_test",
    postCallback: async (url, body) => { posts.push({ url, body }); },
    openUrl: async (url) => { opened.push(url); },
    addRequestHistoryItem: (item) => { added.push(item); },
    updateRequestHistoryItem: (id, patch) => { updates.push({ id, patch }); },
    recordAuditEvent: (event) => { audits.push(event); },
    ...overrides,
  };
  return { deps, added, updates, audits, posts, opened };
}

const transferEnvelope: GlyphEnvelope = {
  request: {
    type: "transfer",
    dapp: { name: "Demo", origin: "https://demo.app" },
    nonce: "nonce-1",
    to: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    amount: "1000",
  },
  callback: "https://demo.app/callback",
  redirect_uri: "https://demo.app/return",
};

describe("request orchestration", () => {
  test("redirect result preserves existing query parameters and fragments", () => {
    const result = buildRedirectUrl("https://demo.app/return?state=abc#done", '{"ok":true}');
    const url = new URL(result);
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("result")).toBeTruthy();
    expect(url.hash).toBe("#done");
  });

  test("approves transfer, records history, delivers callback, and opens redirect", async () => {
    const { deps, added, updates, posts, opened } = makeDeps();

    const success = await approveRequest(deps, {
      envelope: transferEnvelope,
      approval: { kind: "tx", approve: { txHash: "tx-1", targetTick: 42, identity: "ID1" } },
      vaults: [{ id: "v1", name: "Vault", accounts: [{ index: 0, name: "Main", identity: "ID1" }] }],
    });

    expect(success.kind).toBe("tx");
    expect(success.detail).toBe("tx-1");
    expect(success.callbackStatus).toBe("ok");
    expect(added[0]).toMatchObject({
      id: "req_test",
      action: "approved",
      accountName: "Main",
      resultKind: "tx",
      resultDetail: "tx-1",
      callbackStatus: "pending",
    });
    expect(JSON.parse(added[0].callbackBody ?? "{}")).toMatchObject({ status: "signed", tx_hash: "tx-1", target_tick: 42 });
    expect(posts).toEqual([{ url: "https://demo.app/callback", body: added[0].callbackBody! }]);
    expect(updates).toEqual([{ id: "req_test", patch: { callbackStatus: "ok", callbackUpdatedAt: 1234 } }]);
    expect(opened[0]).toBe(buildRedirectUrl("https://demo.app/return", added[0].callbackBody!));
  });

  test("rejects request and records failed callback delivery", async () => {
    const { deps, added, updates, audits } = makeDeps({ postCallback: async () => { throw new Error("offline"); } });

    await rejectRequest(deps, transferEnvelope);

    expect(added[0]).toMatchObject({ action: "rejected", callbackStatus: "pending" });
    expect(JSON.parse(added[0].callbackBody ?? "{}")).toEqual({
      status: "rejected",
      nonce: "nonce-1",
      type: "transfer",
      reason: "user_rejected",
    });
    expect(updates).toEqual([{ id: "req_test", patch: { callbackStatus: "failed", callbackUpdatedAt: 1234 } }]);
    expect(audits).toContainEqual({ kind: "request_callback_failed", status: "failure", title: "Callback failed", detail: "https://demo.app/callback" });
  });

  test("delivery without callback still opens redirect and reports ok", async () => {
    const { deps, posts, opened } = makeDeps();

    const status = await deliverRequestResult(deps, {
      callbackBody: '{"ok":true}',
      callbackUrl: null,
      redirectUri: "https://demo.app/return",
      requestHistoryId: null,
    });

    expect(status).toBe("ok");
    expect(posts).toEqual([]);
    expect(opened).toEqual([buildRedirectUrl("https://demo.app/return", '{"ok":true}')]);
  });
});
