import type { ApproveResult } from "@/components/request/transfer-preview";
import type { SignMessageApproveResult } from "@/components/request/sign-message-preview";
import type { ConnectApproveResult } from "@/components/request/connect-preview";
import type { VerifyMessageResult } from "@/components/request/verify-message-preview";
import { buildSignedCallbackEnvelope } from "@/lib/callback-envelope";
import { signCallbackMessageFromSession } from "@/lib/secure-session";
import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";
import type { RequestHistoryItem, VaultMeta } from "@/store/persisted";

export type CallbackStatus = "pending" | "ok" | "failed";

export interface RequestSuccessState {
  kind: "tx" | "message" | "verify" | "connect";
  detail: string;
  hasCallback: boolean;
  callbackStatus: CallbackStatus;
  callbackBody: string;
  callbackUrl: string | null;
  requestHistoryId: string | null;
}

export type RequestAuditEvent =
  | {
      kind: "request_approved" | "request_rejected";
      status: "success" | "info";
      title: string;
      detail: string;
    }
  | {
      kind: "request_callback_failed";
      status: "failure";
      title: "Callback failed";
      detail: string;
    };

export interface RequestOrchestrationDeps {
  now: () => number;
  makeRequestHistoryId: () => string;
  postCallback: (url: string, body: string) => Promise<unknown>;
  openUrl: (url: string) => Promise<unknown>;
  addRequestHistoryItem: (item: RequestHistoryItem) => void;
  updateRequestHistoryItem: (id: string, patch: Partial<RequestHistoryItem>) => void;
  recordAuditEvent: (event: RequestAuditEvent) => void;
  signCallbackMessage?: typeof signCallbackMessageFromSession;
  callbackNetworkId?: GlyphEnvelope["network"]["id"];
}

function nowEpochSeconds(deps: Pick<RequestOrchestrationDeps, "now">) {
  return Math.floor(deps.now() / 1000);
}

export type RequestApprovalResult =
  | { kind: "tx"; approve: ApproveResult }
  | { kind: "message"; approve: SignMessageApproveResult }
  | { kind: "verify"; approve: VerifyMessageResult }
  | { kind: "connect"; approve: ConnectApproveResult };

export function makeRequestHistoryId() {
  return `req_${crypto.randomUUID()}`;
}

export function getAccountNameForIdentity(vaults: VaultMeta[], identity: string) {
  for (const vault of vaults) {
    const account = vault.accounts.find((candidate) => candidate.identity === identity);
    if (account) return account.name;
  }
  return undefined;
}

export function encodeCallbackResult(body: string) {
  return btoa(body).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function buildRedirectUrl(redirectUri: string, callbackBody: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("result", encodeCallbackResult(callbackBody));
  return url.toString();
}

export async function deliverRequestResult(
  deps: RequestOrchestrationDeps,
  input: {
    callbackBody: string;
    callbackUrl: string | null;
    redirectUri: string | null;
    requestHistoryId: string | null;
  },
): Promise<CallbackStatus> {
  let callbackStatus: CallbackStatus = "ok";

  if (input.callbackUrl) {
    try {
      await deps.postCallback(input.callbackUrl, input.callbackBody);
      callbackStatus = "ok";
      if (input.requestHistoryId) {
        deps.updateRequestHistoryItem(input.requestHistoryId, {
          callbackStatus: "ok",
          callbackUpdatedAt: deps.now(),
        });
      }
    } catch {
      callbackStatus = "failed";
      if (input.requestHistoryId) {
        deps.updateRequestHistoryItem(input.requestHistoryId, {
          callbackStatus: "failed",
          callbackUpdatedAt: deps.now(),
        });
      }
      deps.recordAuditEvent({
        kind: "request_callback_failed",
        status: "failure",
        title: "Callback failed",
        detail: input.callbackUrl,
      });
    }
  }

  if (input.redirectUri) {
    await deps.openUrl(buildRedirectUrl(input.redirectUri, input.callbackBody)).catch(() => {});
  }

  return callbackStatus;
}

export async function rejectRequest(
  deps: RequestOrchestrationDeps,
  envelope: GlyphEnvelope,
): Promise<{ requestHistoryId: string; callbackBody: string }> {
  const requestHistoryId = deps.makeRequestHistoryId();
  const response: GlyphCallbackResponse = {
    status: "rejected",
    nonce: envelope.request.nonce,
    type: envelope.request.type,
    reason: "user_rejected",
  };
  const callbackBody = JSON.stringify(await buildSignedCallbackEnvelope({
    envelope,
    result: response,
    identity: "",
    accountIndex: 0,
    signCallbackMessage: deps.signCallbackMessage ?? signCallbackMessageFromSession,
    networkId: deps.callbackNetworkId,
    nowEpochSeconds: () => nowEpochSeconds(deps),
  }));

  deps.addRequestHistoryItem({
    id: requestHistoryId,
    createdAt: deps.now(),
    type: envelope.request.type,
    dappName: envelope.request.dapp.name || "Unknown dApp",
    dappOrigin: envelope.request.dapp.origin,
    action: "rejected",
    callbackStatus: envelope.callback ? "pending" : "none",
    callbackUrl: envelope.callback,
    callbackBody,
    callbackUpdatedAt: envelope.callback ? deps.now() : null,
  });
  deps.recordAuditEvent({
    kind: "request_rejected",
    status: "info",
    title: "Request rejected",
    detail: `${envelope.request.type} from ${envelope.request.dapp.origin}`,
  });

  await deliverRequestResult(deps, {
    callbackBody,
    callbackUrl: envelope.callback,
    redirectUri: envelope.redirect_uri ?? null,
    requestHistoryId,
  });

  return { requestHistoryId, callbackBody };
}

export async function approveRequest(
  deps: RequestOrchestrationDeps,
  input: {
    envelope: GlyphEnvelope;
    approval: RequestApprovalResult;
    vaults: VaultMeta[];
  },
): Promise<RequestSuccessState> {
  const requestHistoryId = deps.makeRequestHistoryId();
  const callbackUrl = input.envelope.callback;
  const redirectUri = input.envelope.redirect_uri ?? null;
  const { response, success, history, auditTitle, auditDetail } = buildApprovalArtifacts(input.envelope, input.approval);
  const identity = getApprovalIdentity(input.approval);
  const callbackBody = JSON.stringify(await buildSignedCallbackEnvelope({
    envelope: input.envelope,
    result: response,
    identity,
    accountIndex: getApprovalAccountIndex(input.approval),
    signCallbackMessage: deps.signCallbackMessage ?? signCallbackMessageFromSession,
    networkId: deps.callbackNetworkId,
    nowEpochSeconds: () => nowEpochSeconds(deps),
  }));

  deps.recordAuditEvent({
    kind: "request_approved",
    status: "success",
    title: auditTitle,
    detail: auditDetail,
  });
  deps.addRequestHistoryItem({
    id: requestHistoryId,
    createdAt: deps.now(),
    type: input.envelope.request.type,
    dappName: input.envelope.request.dapp.name || "Unknown dApp",
    dappOrigin: input.envelope.request.dapp.origin,
    action: "approved",
    accountIdentity: identity,
    accountName: getAccountNameForIdentity(input.vaults, identity),
    resultKind: history.resultKind,
    resultDetail: history.resultDetail,
    callbackStatus: callbackUrl ? "pending" : "none",
    callbackUrl,
    callbackBody,
    callbackUpdatedAt: callbackUrl ? deps.now() : null,
  });

  const initialState: RequestSuccessState = {
    ...success,
    hasCallback: !!callbackUrl,
    callbackStatus: "pending",
    callbackBody,
    callbackUrl,
    requestHistoryId,
  };

  const callbackStatus = await deliverRequestResult(deps, {
    callbackBody,
    callbackUrl,
    redirectUri,
    requestHistoryId,
  });

  return { ...initialState, callbackStatus };
}

function buildApprovalArtifacts(envelope: GlyphEnvelope, approval: RequestApprovalResult): {
  response: GlyphCallbackResponse;
  success: Pick<RequestSuccessState, "kind" | "detail">;
  history: Pick<RequestHistoryItem, "resultKind" | "resultDetail">;
  auditTitle: string;
  auditDetail: string;
} {
  switch (approval.kind) {
    case "tx":
      return {
        response: {
          status: "signed",
          type: envelope.request.type as "transfer" | "sc_call",
          nonce: envelope.request.nonce,
          identity: approval.approve.identity,
          tx_hash: approval.approve.txHash,
          target_tick: approval.approve.targetTick,
        },
        success: { kind: "tx", detail: approval.approve.txHash },
        history: { resultKind: "tx", resultDetail: approval.approve.txHash },
        auditTitle: "Request approved",
        auditDetail: `${envelope.request.type} from ${envelope.request.dapp.origin}`,
      };
    case "message":
      return {
        response: {
          status: "signed",
          type: "sign_message",
          nonce: envelope.request.nonce,
          identity: approval.approve.identity,
          signature: approval.approve.signature,
          public_key: approval.approve.publicKey,
        },
        success: { kind: "message", detail: approval.approve.signature },
        history: { resultKind: "message", resultDetail: approval.approve.signature },
        auditTitle: "Message signed",
        auditDetail: envelope.request.dapp.origin,
      };
    case "verify":
      return {
        response: {
          status: "verified",
          type: "verify_message",
          nonce: envelope.request.nonce,
          valid: approval.approve.valid,
          identity: approval.approve.identity,
        },
        success: { kind: "verify", detail: approval.approve.valid ? "VALID" : "INVALID" },
        history: { resultKind: "verify", resultDetail: approval.approve.valid ? "VALID" : "INVALID" },
        auditTitle: "Signature verified",
        auditDetail: envelope.request.dapp.origin,
      };
    case "connect":
      return {
        response: {
          status: "connected",
          type: "connect",
          nonce: envelope.request.nonce,
          identity: approval.approve.identity,
          permissions: approval.approve.permissions,
        },
        success: { kind: "connect", detail: approval.approve.identity },
        history: { resultKind: "connect", resultDetail: approval.approve.identity },
        auditTitle: "Connection approved",
        auditDetail: envelope.request.dapp.origin,
      };
  }
}

function getApprovalIdentity(approval: RequestApprovalResult) {
  return approval.approve.identity;
}

function getApprovalAccountIndex(approval: RequestApprovalResult) {
  return "accountIndex" in approval.approve ? approval.approve.accountIndex : 0;
}
