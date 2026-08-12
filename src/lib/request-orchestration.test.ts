import { describe, expect, test } from "bun:test";
import { approveRequest, buildRedirectUrl, deliverRequestResult, rejectRequest, type RequestOrchestrationDeps } from "@/lib/request-orchestration";
import type { GlyphEnvelope } from "@/lib/request-schema";
import type { RequestHistoryItem } from "@/store/persisted";
import { REQUEST_PROTOCOL_V2 } from "@/lib/jcs";

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
  protocol: REQUEST_PROTOCOL_V2,
  request: {
    type: "transfer",
    dapp: { name: "Demo", origin: "https://demo.app" },
    nonce: "nonce-1",
    to: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    amount: "1000",
  },
  callback: "https://demo.app/callback",
  redirect_uri: "https://demo.app/return",
  network: { id: "qubic:mainnet" },
  request_hash: "sha256:requestHash_12345678901234567890123456789012",
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
    const callbackEnvelope = JSON.parse(added[0].callbackBody ?? "{}");
    expect(callbackEnvelope).toMatchObject({
      version: "glyph-connect-callback-envelope/2",
      result: { status: "signed", tx_hash: "tx-1", target_tick: 42 },
      payload: {
        request_hash: transferEnvelope.request_hash,
        network: { id: "qubic:mainnet" },
        nonce: "nonce-1",
        dapp_origin: "https://demo.app",
        request_type: "transfer",
        exp: null,
        relay: { callback_url: "https://demo.app/callback", official_relay: false, route: "unknown", v1_nonce: null, session_id: null, callback_capability_fingerprint: null },
      },
      proof: { algorithm: "qubic-schnorrq-sha256", identity: "ID1", public_key: "BwgJ" },
    });
    expect(callbackEnvelope.proof.signed_payload).toContain('"result_hash"');
    expect(callbackSignatures).toHaveLength(1);
    expect(posts).toEqual([{ url: "https://demo.app/callback", body: added[0].callbackBody! }]);
    expect(updates).toEqual([{ id: "req_test", patch: { callbackStatus: "ok", callbackUpdatedAt: 1234 } }]);
    expect(opened[0]).toBe(buildRedirectUrl("https://demo.app/return", added[0].callbackBody!));
  });

  test("rejects request and records failed callback delivery", async () => {
    const { deps, added, updates, audits, callbackSignatures } = makeDeps({ postCallback: async () => { throw new Error("offline"); } });

    await rejectRequest(deps, transferEnvelope);

    expect(added[0]).toMatchObject({ action: "rejected", callbackStatus: "pending" });
    const callbackEnvelope = JSON.parse(added[0].callbackBody ?? "{}");
    expect(callbackEnvelope).toMatchObject({
      version: "glyph-connect-callback-envelope/2",
      result: {
        status: "rejected",
        nonce: "nonce-1",
        type: "transfer",
        reason: "user_rejected",
      },
      payload: { issued_at: 1, exp: null, request_type: "transfer" },
      proof: { algorithm: "qubic-schnorrq-sha256", identity: "ID1" },
    });
    expect(Number.isSafeInteger(callbackEnvelope.payload.issued_at)).toBe(true);
    expect(callbackSignatures).toHaveLength(1);
    expect(callbackEnvelope.proof.signed_payload).toContain('"result_hash":"sha256:');
    expect(updates).toEqual([{ id: "req_test", patch: { callbackStatus: "failed", callbackUpdatedAt: 1234 } }]);
    expect(audits).toContainEqual({ kind: "request_callback_failed", status: "failure", title: "Callback failed", detail: "https://demo.app/callback" });
  });

  test("approved sign_message keeps the user signature distinct from the callback proof", async () => {
    const { deps, added, posts, callbackSignatures } = makeDeps();
    await approveRequest(deps, {
      envelope: {
        protocol: REQUEST_PROTOCOL_V2,
        request: {
          type: "sign_message",
          dapp: { name: "Demo", origin: "https://demo.app" },
          nonce: "nonce-message",
          message: "hello",
        },
        callback: "https://demo.app/callback",
        redirect_uri: null,
        network: { id: "qubic:mainnet" },
        request_hash: "sha256:messageHash_12345678901234567890123456789012",
      },
      approval: {
        kind: "message",
        approve: { signature: "USER_MESSAGE_SIGNATURE", publicKey: "USER_PUBLIC_KEY", identity: "ID1", accountIndex: 2 },
      },
      vaults: [{ id: "v1", name: "Vault", accounts: [{ index: 2, name: "Main", identity: "ID1" }] }],
    });

    const body = JSON.parse(added[0].callbackBody ?? "{}");
    expect(body.result.signature).toBe("USER_MESSAGE_SIGNATURE");
    expect(body.proof.signature).not.toBe("USER_MESSAGE_SIGNATURE");
    expect(callbackSignatures).toHaveLength(1);
    expect(callbackSignatures[0]?.accountIndex).toBe(2);
    expect(new TextDecoder().decode(callbackSignatures[0]!.payload)).toBe(body.proof.signed_payload);
    expect(posts).toHaveLength(1);
  });

  test("Connect and Verify each single-sign their approved callback", async () => {
    const cases = [
      {
        approval: { kind: "connect" as const, approve: { identity: "ID1", accountIndex: 1, permissions: ["sign_message" as const] } },
        request: { type: "connect" as const, dapp: { name: "Demo", origin: "https://demo.app" }, nonce: "nonce-connect", permissions: ["sign_message" as const] },
      },
      {
        approval: { kind: "verify" as const, approve: { valid: true, identity: "EXTERNAL", accountIndex: 1 } },
        request: { type: "verify_message" as const, dapp: { name: "Demo", origin: "https://demo.app" }, nonce: "nonce-verify", message: "hello", signature: "sig", public_key: "key" },
      },
    ];

    for (const testCase of cases) {
      const { deps, added, posts, callbackSignatures } = makeDeps();
      await approveRequest(deps, {
        envelope: {
          protocol: REQUEST_PROTOCOL_V2,
          request: testCase.request,
          callback: "https://demo.app/callback",
          redirect_uri: null,
          network: { id: "qubic:mainnet" },
          request_hash: `sha256:${testCase.request.nonce.padEnd(43, "x")}`,
        },
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
