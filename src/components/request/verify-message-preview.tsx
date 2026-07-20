import { useState, useMemo } from "react";
import { Button } from "@/components/button";
import { k12, verify, publicKeyToIdentity } from "@qubic.org/crypto";
import { truncateId } from "@/lib/format";
import { useSessionStore } from "@/store/session";
import { RequestActionBar, RequestDetailRow, RequestSectionTitle, RequestTechnicalBlock } from "./request-primitives";
import type { VerifyMessageRequest } from "@/lib/request-schema";

export type { VerifyMessageRequest } from "@/lib/request-schema";

export interface VerifyMessageResult {
  valid: boolean;
  identity: string;
}

interface VerifyMessagePreviewProps {
  request: VerifyMessageRequest;
  onApprove: (result: VerifyMessageResult) => void;
  onReject: () => void;
}

function base64ToBytes(b64: string): Uint8Array {
  try {
    const binary = atob(b64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}

export function VerifyMessagePreview({ request, onApprove, onReject }: VerifyMessagePreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const wallets = useSessionStore((s) => s.wallets);

  const publicKeyBytes = useMemo(() => base64ToBytes(request.public_key), [request.public_key]);

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
      onApprove({ valid, identity: claimedIdentity ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
      setProcessing(false);
    }
  }

  const invalidKey = claimedIdentity === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        This verifies a signature locally. No transaction will be broadcast.
      </div>

      <div>
        <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Message</RequestSectionTitle></div>
        <RequestTechnicalBlock maxHeight={160}>
          {request.message}
        </RequestTechnicalBlock>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <RequestDetailRow
          label="Claimed signer"
          value={invalidKey ? "Invalid public key" : truncateId(claimedIdentity!, 10, 10)}
          valueColor={invalidKey ? "var(--color-status-error)" : undefined}
          badge={!invalidKey ? (isOwnIdentity ? "Your wallet" : "External") : undefined}
        />
        <RequestDetailRow label="Signature" value={truncateId(request.signature, 10, 10)} />
      </div>

      {invalidKey && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          Cannot verify — invalid public key
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
