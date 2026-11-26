import type { SigningAuthorizationContext } from "@/lib/secure-session";
import type { ApproveResult } from "@/lib/request-approvals";

/** Props shared by previews that broadcast a transaction (transfer, contract call). */
export interface TransactionPreviewProps<TRequest> {
  request: TRequest;
  onApprove: (result: ApproveResult, authorization: SigningAuthorizationContext) => void | Promise<void>;
  authorize: (accountIndex: number, intent: string) => Promise<SigningAuthorizationContext>;
  onReject: () => void;
}
