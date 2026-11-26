import { useState, useMemo } from "react";
import { k12, verify, publicKeyToIdentity } from "@qubic.org/crypto";
import { base64ToBytes } from "@/lib/base64";
import { ShieldCheckIcon } from "@/lib/icons";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { RequestApprovalActions, RequestInlineNotice } from "./request-primitives";
import { ApprovalAddress } from "./approval-address";
import { ApprovalField } from "./approval-field";
import { ApprovalMessage } from "./approval-message";
import type { VerifyMessageRequest } from "@/lib/request-schema";
import type { VerifyMessageResult } from "@/lib/request-approvals";

export type { VerifyMessageRequest } from "@/lib/request-schema";

interface VerifyMessagePreviewProps {
  request: VerifyMessageRequest;
  onApprove: (result: VerifyMessageResult) => void | Promise<void>;
  onReject: () => void;
}

export function VerifyMessagePreview({ request, onApprove, onReject }: VerifyMessagePreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: 0 }}>
      <ApprovalMessage
        title={request.data ? "Data to verify" : "Message"}
        data={request.data}
        message={request.message}
        dataByteCount={dataByteCount}
      />

      {!invalidKey ? (
        <ApprovalAddress
          label="Signer"
          identity={claimedIdentity!}
          name={isOwnIdentity ? "Your address" : "Other address"}
          compact="long"
        />
      ) : null}

      <ApprovalField label="Signature">
        <span title={request.signature} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.03em", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
          {request.signature}
        </span>
      </ApprovalField>

      {invalidKey && <RequestInlineNotice tone="error">Invalid public key</RequestInlineNotice>}

      {error && <RequestInlineNotice tone="error">{error}</RequestInlineNotice>}

      <RequestApprovalActions
        onReject={onReject}
        onApprove={handleVerify}
        approveLabel="Verify and respond"
        approveIcon={<ShieldCheckIcon size={16} aria-hidden="true" />}
        approveLoading={processing}
        approveDisabled={invalidKey}
      />
    </div>
  );
}
