import { useState, useMemo } from "react";
import { k12, verify, publicKeyToIdentity } from "@qubic.org/crypto";
import { truncateId } from "@/lib/format";
import { base64ToBytes } from "@/lib/base64";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { RequestApprovalActions, RequestDetailRow, RequestInlineNotice } from "./request-primitives";
import { RequestMessageContent } from "./request-message-content";
import type { VerifyMessageRequest } from "@/lib/request-schema";
import type { VerifyMessageResult } from "@/lib/request-approvals";
import { useReviewMode } from "@/screens/request/review-mode";

export type { VerifyMessageRequest } from "@/lib/request-schema";

interface VerifyMessagePreviewProps {
  request: VerifyMessageRequest;
  onApprove: (result: VerifyMessageResult) => void | Promise<void>;
  onReject: () => void;
}

export function VerifyMessagePreview({ request, onApprove, onReject }: VerifyMessagePreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const { approvalWindow } = useReviewMode();
  const accounts = useSessionStore((s) => s.accounts);
  const activeAccountIndex = usePersistedStore((s) => s.settings.activeAccountIndex);

  const publicKeyBytes = useMemo(() => base64ToBytes(request.public_key), [request.public_key]);
  const dataByteCount = useMemo(() => {
    if (!request.data) return null;
    try {
      return base64ToBytes(request.data).length;
    } catch {
      return null;
    }
  }, [request.data]);

  const claimedIdentity = useMemo(() => {
    try {
      return publicKeyToIdentity(publicKeyBytes) as string;
    } catch {
      return null;
    }
  }, [publicKeyBytes]);

  const isOwnIdentity = claimedIdentity !== null && accounts.some((w) => w.identity === claimedIdentity);

  async function handleVerify() {
    setProcessing(true);
    setError("");
    try {
      const messageBytes = request.data
        ? base64ToBytes(request.data)
        : new TextEncoder().encode(request.message);
      const digest = k12(messageBytes, 32);
      const signatureBytes = base64ToBytes(request.signature);
      const valid = verify(digest, signatureBytes, publicKeyBytes);
      await onApprove({ valid, identity: claimedIdentity ?? "", accountIndex: activeAccountIndex });
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
      setProcessing(false);
    }
  }

  const invalidKey = claimedIdentity === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: approvalWindow ? "var(--space-3)" : "var(--space-6)", flex: 1, minHeight: approvalWindow ? 0 : "100%" }}>
      <RequestMessageContent
        title={request.data ? "Data to verify" : "Message"}
        data={request.data}
        message={request.message}
        dataByteCount={dataByteCount}
        plainTextMaxHeight={approvalWindow ? 110 : 160}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <RequestDetailRow
          label="Signer"
          value={invalidKey ? "Invalid public key" : truncateId(claimedIdentity!, 10, 10)}
          valueColor={invalidKey ? "var(--color-status-error)" : undefined}
          badge={!invalidKey ? (isOwnIdentity ? "Your address" : "Other address") : undefined}
        />
        <RequestDetailRow label="Signature" value={truncateId(request.signature, 10, 10)} />
      </div>

      {invalidKey && <RequestInlineNotice tone="error">Invalid public key</RequestInlineNotice>}

      {error && <RequestInlineNotice tone="error">{error}</RequestInlineNotice>}

      <RequestApprovalActions
        onReject={onReject}
        onApprove={handleVerify}
        approveLabel="Verify and respond"
        approveLoading={processing}
        approveDisabled={invalidKey}
      />
    </div>
  );
}
