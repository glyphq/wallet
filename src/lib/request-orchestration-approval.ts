import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";
import type { RequestHistoryItem } from "@/store/persisted";
import type {
  RequestApprovalResult,
  RequestSuccessState,
} from "./request-orchestration-types";

export function buildApprovalArtifacts(envelope: GlyphEnvelope, approval: RequestApprovalResult): {
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
        },
        success: { kind: "connect", detail: approval.approve.identity },
        history: { resultKind: "connect", resultDetail: approval.approve.identity },
        auditTitle: "Connection approved",
        auditDetail: envelope.request.dapp.origin,
      };
  }
}

export function getApprovalIdentity(approval: RequestApprovalResult) {
  return approval.approve.identity;
}

export function getApprovalAccountIndex(approval: RequestApprovalResult) {
  return "accountIndex" in approval.approve ? approval.approve.accountIndex : 0;
}
