import type {
  ApproveResult,
  ConnectApproveResult,
  SignMessageApproveResult,
  VerifyMessageResult,
} from "@/lib/request-approvals";
import type { signCallbackMessageFromSession } from "@/lib/secure-session";
import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";
import type { RequestHistoryItem } from "@/store/persisted";

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
  signCallbackMessage?: (accountIndex: number, messageBytes: Uint8Array, result: GlyphCallbackResponse) => ReturnType<typeof signCallbackMessageFromSession>;
  callbackNetworkId?: GlyphEnvelope["network"]["id"];
}

export type RequestApprovalResult =
  | { kind: "tx"; approve: ApproveResult }
  | { kind: "message"; approve: SignMessageApproveResult }
  | { kind: "verify"; approve: VerifyMessageResult }
  | { kind: "connect"; approve: ConnectApproveResult };
