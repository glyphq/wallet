import { RequestHeader } from "@/components/request/request-header";
import { TransferPreview } from "@/components/request/transfer-preview";
import { ScCallPreview } from "@/components/request/sc-call-preview";
import { SignMessagePreview } from "@/components/request/sign-message-preview";
import { ConnectPreview } from "@/components/request/connect-preview";
import { VerifyMessagePreview } from "@/components/request/verify-message-preview";
import type {
  ApproveResult,
  ConnectApproveResult,
  SignMessageApproveResult,
  VerifyMessageResult,
} from "@/lib/request-approvals";
import type { GlyphRequest } from "@/lib/request-schema";

const ACTION_PHRASE: Record<GlyphRequest["type"], string> = {
  transfer: "send QUBIC",
  sc_call: "call a contract",
  sign_message: "sign a message",
  verify_message: "verify a message",
  connect: "connect",
};
import type { SigningAuthorizationContext } from "@/lib/secure-session";
import { SheetLayout, StatusLine } from "./sheet-layout";

/** Active request review: dApp header, queue/error notices, and the type-specific preview. */
export function RequestApprovalView({
  request,
  pendingRequestCount,
  actionError,
  expirySecsLeft,
  onReject,
  authorize,
  onApprove,
  onApproveMessage,
  onApproveVerify,
  onApproveConnect,
}: {
  request: GlyphRequest;
  pendingRequestCount: number;
  actionError: string | null;
  expirySecsLeft: number | null;
  onReject: () => void;
  authorize: (accountIndex: number, intent: string) => Promise<SigningAuthorizationContext>;
  onApprove: (result: ApproveResult, authorization: SigningAuthorizationContext) => void | Promise<void>;
  onApproveMessage: (result: SignMessageApproveResult, authorization: SigningAuthorizationContext) => void | Promise<void>;
  onApproveVerify: (result: VerifyMessageResult) => void | Promise<void>;
  onApproveConnect: (result: ConnectApproveResult) => void | Promise<void>;
}) {
  return (
    <SheetLayout expirySecsLeft={expirySecsLeft} pendingRequestCount={pendingRequestCount}>
      <RequestHeader dapp={request.dapp} action={ACTION_PHRASE[request.type]} />
      {actionError && <StatusLine tone="error">{actionError}</StatusLine>}

      {request.type === "transfer" ? (
        <TransferPreview
          request={request}
          onApprove={onApprove}
          authorize={authorize}
          onReject={onReject}
        />
      ) : request.type === "sc_call" ? (
        <ScCallPreview
          request={request}
          onApprove={onApprove}
          authorize={authorize}
          onReject={onReject}
        />
      ) : request.type === "sign_message" ? (
        <SignMessagePreview
          request={request}
          onApprove={onApproveMessage}
          authorize={authorize}
          onReject={onReject}
        />
      ) : request.type === "verify_message" ? (
        <VerifyMessagePreview
          request={request}
          onApprove={onApproveVerify}
          onReject={onReject}
        />
      ) : request.type === "connect" ? (
        <ConnectPreview
          request={request}
          onApprove={onApproveConnect}
          onReject={onReject}
        />
      ) : null}
    </SheetLayout>
  );
}
