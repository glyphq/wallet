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
  const callbackSignatures: Array<{ accountIndex: number; payload: Uint8Array }> = [];
  const deps: RequestOrchestrationDeps = {
    now: () => 1234,
    makeRequestHistoryId: () => "req_test",
    postCallback: async (url, body) => { posts.push({ url, body }); },
    openUrl: async (url) => { opened.push(url); },
    addRequestHistoryItem: (item) => { added.push(item); },
    updateRequestHistoryItem: (id, patch) => { updates.push({ id, patch }); },
    recordAuditEvent: (event) => { audits.push(event); },
    signCallbackMessage: async (accountIndex, payload) => {
      callbackSignatures.push({ accountIndex, payload });
      return { signature: new Uint8Array([accountIndex, 7]), publicKey: new Uint8Array([7, 8, 9]), identity: "ID1" };
    },
    ...overrides,
  };
  return { deps, added, updates, audits, posts, opened, callbackSignatures };
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
    const { deps, added, updates, posts, opened, callbackSignatures } = makeDeps();

    const success = await approveRequest(deps, {
      envelope: transferEnvelope,
      approval: { kind: "tx", approve: { txHash: "tx-1", targetTick: 42, identity: "ID1", accountIndex: 0 } },
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
    expect(JSON.parse(added[0].callbackBody ?? "{}")).toMatchObject({
      version: "glyph-connect-callback-envelope/2",
      result: { status: "signed", tx_hash: "tx-1", target_tick: 42 },
      proof: { algorithm: "qubic-schnorrq-sha256", identity: "ID1", public_key: "BwgJ" },
    });
    expect(callbackSignatures).toHaveLength(1);
    expect(posts).toEqual([{ url: "https://demo.app/callback", body: added[0].callbackBody! }]);
    expect(updates).toEqual([{ id: "req_test", patch: { callbackStatus: "ok", callbackUpdatedAt: 1234 } }]);
    expect(opened[0]).toBe(buildRedirectUrl("https://demo.app/return", added[0].callbackBody!));
  });

  test("rejects request and records failed callback delivery", async () => {
    const { deps, added, updates, audits, callbackSignatures } = makeDeps({ postCallback: async () => { throw new Error("offline"); } });

    await rejectRequest(deps, transferEnvelope);

    expect(added[0]).toMatchObject({ action: "rejected", callbackStatus: "pending" });
    expect(JSON.parse(added[0].callbackBody ?? "{}")).toMatchObject({
      version: "glyph-connect-callback-envelope/2",
      result: { status: "rejected", nonce: "nonce-1", type: "transfer", reason: "user_rejected" },
      proof: { algorithm: "qubic-schnorrq-sha256", identity: "ID1" },
    });
    expect(callbackSignatures).toHaveLength(1);
    expect(updates).toEqual([{ id: "req_test", patch: { callbackStatus: "failed", callbackUpdatedAt: 1234 } }]);
    expect(audits).toContainEqual({ kind: "request_callback_failed", status: "failure", title: "Callback failed", detail: "https://demo.app/callback" });
  });

  test("approved sign_message uses the user signature as a result and a distinct callback signature for delivery", async () => {
    const { deps, added, posts, callbackSignatures } = makeDeps();
    const success = await approveRequest(deps, {
      envelope: {
        request: {
          type: "sign_message",
          dapp: { name: "Demo", origin: "https://demo.app" },
          nonce: "nonce-message",
          message: "hello",
        },
        callback: "https://demo.app/callback",
        redirect_uri: null,
      },
      approval: {
        kind: "message",
        approve: {
          signature: "USER_MESSAGE_SIGNATURE",
          publicKey: "USER_PUBLIC_KEY",
          identity: "ID1",
          accountIndex: 2,
        },
      },
      vaults: [{ id: "v1", name: "Vault", accounts: [{ index: 2, name: "Main", identity: "ID1" }] }],
    });

    const body = JSON.parse(added[0].callbackBody ?? "{}");
    expect(success.callbackStatus).toBe("ok");
    expect(body.result.signature).toBe("USER_MESSAGE_SIGNATURE");
    expect(body.proof.signature).not.toBe("USER_MESSAGE_SIGNATURE");
    expect(callbackSignatures).toHaveLength(1);
    expect(callbackSignatures[0]?.accountIndex).toBe(2);
    expect(new TextDecoder().decode(callbackSignatures[0]!.payload)).toBe(body.proof.signed_payload);
    expect(posts).toEqual([{ url: "https://demo.app/callback", body: added[0].callbackBody! }]);
  });

  test("connect and verify approvals each use one callback signature and deliver signed responses", async () => {
    const cases = [
      {
        kind: "connect" as const,
        approval: { kind: "connect" as const, approve: { identity: "ID1", accountIndex: 1, permissions: ["sign_message" as const] } },
        request: { type: "connect" as const, dapp: { name: "Demo", origin: "https://demo.app" }, nonce: "nonce-connect", permissions: ["sign_message" as const] },
      },
      {
        kind: "verify" as const,
        approval: { kind: "verify" as const, approve: { valid: true, identity: "EXTERNAL", accountIndex: 1 } },
        request: { type: "verify_message" as const, dapp: { name: "Demo", origin: "https://demo.app" }, nonce: "nonce-verify", message: "hello", signature: "sig", public_key: "key" },
      },
    ];

    for (const testCase of cases) {
      const { deps, added, posts, callbackSignatures } = makeDeps();
      await approveRequest(deps, {
        envelope: { request: testCase.request, callback: "https://demo.app/callback", redirect_uri: null },
        approval: testCase.approval,
        vaults: [{ id: "v1", name: "Vault", accounts: [{ index: 1, name: "Main", identity: "ID1" }] }],
      });
      expect(callbackSignatures).toHaveLength(1);
      expect(callbackSignatures[0]?.accountIndex).toBe(1);
      expect(JSON.parse(added[0].callbackBody ?? "{}").proof.algorithm).toBe("qubic-schnorrq-sha256");
      expect(posts).toHaveLength(1);
    }
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
