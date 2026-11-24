import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";
import type { WalletMeta } from "@/store/persisted";
import {
  buildSignedCallbackBody,
  deliverRequestResult,
} from "./request-orchestration-delivery";
import {
  buildApprovalArtifacts,
  getApprovalAccountIndex,
  getApprovalIdentity,
} from "./request-orchestration-approval";
import {
  addApprovedRequestHistory,
  addRejectedRequestHistory,
} from "./request-orchestration-history";
import {
  recordApprovedRequestAudit,
  recordRejectedRequestAudit,
} from "./request-orchestration-audit";
import type {
  RequestApprovalResult,
  RequestOrchestrationDeps,
  RequestSuccessState,
} from "./request-orchestration-types";

export type {
  CallbackStatus,
  RequestApprovalResult,
  RequestAuditEvent,
  RequestOrchestrationDeps,
  RequestSuccessState,
} from "./request-orchestration-types";
export {
  buildRedirectUrl,
  deliverRequestResult,
} from "./request-orchestration-delivery";
export { makeRequestHistoryId } from "./request-orchestration-history";

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
  const callbackBody = await buildSignedCallbackBody(deps, {
    envelope,
    result: response,
    identity: "",
    accountIndex: 0,
  });

  addRejectedRequestHistory(deps, { requestHistoryId, envelope, callbackBody });
  recordRejectedRequestAudit(deps, envelope);

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
    wallets: WalletMeta[];
  },
): Promise<RequestSuccessState> {
  const requestHistoryId = deps.makeRequestHistoryId();
  const callbackUrl = input.envelope.callback;
  const redirectUri = input.envelope.redirect_uri ?? null;
  const { response, success, history, auditTitle, auditDetail } = buildApprovalArtifacts(input.envelope, input.approval);
  const identity = getApprovalIdentity(input.approval);
  const callbackBody = await buildSignedCallbackBody(deps, {
    envelope: input.envelope,
    result: response,
    identity,
    accountIndex: getApprovalAccountIndex(input.approval),
  });

  recordApprovedRequestAudit(deps, {
    envelope: input.envelope,
    title: auditTitle,
    detail: auditDetail,
  });
  addApprovedRequestHistory(deps, {
    requestHistoryId,
    envelope: input.envelope,
    identity,
    callbackUrl,
    callbackBody,
    history,
    wallets: input.wallets,
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
