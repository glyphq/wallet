import { useState, useMemo } from "react";
import { Button } from "@/components/button";
import { k12, verify, publicKeyToIdentity } from "@qubic.org/crypto";
import { truncateId } from "@/lib/format";
import { base64ToBytes } from "@/lib/base64";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { RequestActionBar, RequestDetailRow, RequestDisclosure, RequestSectionTitle, RequestTechnicalBlock } from "./request-primitives";
import type { VerifyMessageRequest } from "@/lib/request-schema";

export type { VerifyMessageRequest } from "@/lib/request-schema";

export interface VerifyMessageResult {
  valid: boolean;
  identity: string;
  accountIndex: number;
}

interface VerifyMessagePreviewProps {
  request: VerifyMessageRequest;
  onApprove: (result: VerifyMessageResult) => void | Promise<void>;
  onReject: () => void;
}

function previewText(value: string, maxChars = 2000): string {
  return value.length > maxChars
    ? `${value.slice(0, maxChars)}\n\n[… ${value.length.toLocaleString()} chars total]`
    : value;
}

export function VerifyMessagePreview({ request, onApprove, onReject }: VerifyMessagePreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const wallets = useSessionStore((s) => s.wallets);
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

  const isOwnIdentity = claimedIdentity !== null && wallets.some((w) => w.identity === claimedIdentity);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      <div>
        <div style={{ marginBottom: "var(--space-2)" }}>
          <RequestSectionTitle>{request.data ? "Data to verify" : "Message"}</RequestSectionTitle>
        </div>
        {request.data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <RequestDetailRow label="Payload" value={dataByteCount === null ? "Invalid base64" : `${dataByteCount.toLocaleString()} bytes`} valueColor={dataByteCount === null ? "var(--color-status-error)" : undefined} />
            {request.message && <RequestDetailRow label="Label" value={previewText(request.message, 160)} />}
            <RequestDisclosure label={`Show base64 data${dataByteCount === null ? "" : ` · ${dataByteCount.toLocaleString()}B`}`}>
              <RequestTechnicalBlock maxHeight={160}>{request.data}</RequestTechnicalBlock>
            </RequestDisclosure>
          </div>
        ) : (
          <RequestTechnicalBlock maxHeight={160}>{previewText(request.message)}</RequestTechnicalBlock>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <RequestDetailRow
	          label="Signer"
          value={invalidKey ? "Invalid public key" : truncateId(claimedIdentity!, 10, 10)}
          valueColor={invalidKey ? "var(--color-status-error)" : undefined}
	          badge={!invalidKey ? (isOwnIdentity ? "Your Vault" : "Other identity") : undefined}
        />
        <RequestDetailRow label="Signature" value={truncateId(request.signature, 10, 10)} />
      </div>

      {invalidKey && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
	          Invalid public key
        </div>
      )}

      {error && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          {error}
        </div>
      )}

      <RequestActionBar>
        <Button variant="secondary" onClick={onReject} style={{ flex: 1 }}>
          Reject
        </Button>
        <Button onClick={handleVerify} loading={processing} disabled={invalidKey} style={{ flex: 1 }}>
          Verify and respond
        </Button>
      </RequestActionBar>
    </div>
  );
}
