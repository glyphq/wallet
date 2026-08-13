import { useMemo, useState } from "react";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { signMessageFromSession } from "@/lib/secure-session";
import { truncateId } from "@/lib/format";
import { base64ToBytes } from "@/lib/base64";
import { RequestActionBar, RequestDetailRow, RequestDisclosure, RequestSectionTitle, RequestTechnicalBlock } from "./request-primitives";
import type { SignMessageRequest } from "@/lib/request-schema";
import { DappPolicyStatus } from "@/components/dapp-policy-controls";
import { evaluateDappPermission } from "@/lib/dapp-permissions";

export type { SignMessageRequest } from "@/lib/request-schema";

export interface SignMessageApproveResult {
  signature: string; // base64-encoded 64-byte SchnorrQ signature
  publicKey: string; // base64-encoded 32-byte public key
  identity: string;
  accountIndex: number;
}

interface SignMessagePreviewProps {
  request: SignMessageRequest;
  onApprove: (result: SignMessageApproveResult) => void | Promise<void>;
  onReject: () => void;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function previewText(value: string, maxChars = 2000): string {
  return value.length > maxChars
    ? `${value.slice(0, maxChars)}\n\n[… ${value.length.toLocaleString()} chars total]`
    : value;
}

export function SignMessagePreview({ request, onApprove, onReject }: SignMessagePreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const { wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const vault = usePersistedStore((s) =>
    s.vaults.find((v) => v.id === s.settings.activeVaultId)
  );
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const identity = wallet?.identity ?? "";
  const dataByteCount = useMemo(() => {
    if (!request.data) return null;
    try {
      return base64ToBytes(request.data).length;
    } catch {
      return null;
    }
  }, [request.data]);
  const policyDecision = evaluateDappPermission({
    approvedDapps,
    origin: request.dapp.origin,
    permission: "sign_message",
    identity,
  });

  async function approve() {
    if (!wallet) return;
    const freshPolicyDecision = evaluateDappPermission({
      approvedDapps,
      origin: request.dapp.origin,
      permission: "sign_message",
      identity,
      now: Date.now(),
    });
    if (!freshPolicyDecision.allowed) {
      setError(freshPolicyDecision.reason ?? "dApp policy blocked this signature.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const messageBytes = request.data
        ? base64ToBytes(request.data)
        : new TextEncoder().encode(request.message);
      const { signature, publicKey, identity } = await signMessageFromSession(selectedIndex, messageBytes);
      await onApprove({
        signature: bytesToBase64(signature),
        publicKey: bytesToBase64(publicKey),
        identity,
        accountIndex: selectedIndex,
      });
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signing failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      <div>
        <div style={{ marginBottom: "var(--space-2)" }}>
          <RequestSectionTitle>{request.data ? "Data to sign" : "Message"}</RequestSectionTitle>
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
          <RequestTechnicalBlock>{previewText(request.message)}</RequestTechnicalBlock>
        )}
      </div>

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && vault && (
        <div>
          <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Sign as</RequestSectionTitle></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {vault.accounts.filter((a) => !a.hidden).map((acc) => (
              <button
                key={acc.index}
                onClick={() => setSelectedIndex(acc.index)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
                  letterSpacing: "0.05em", padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-pill)",
                  border: `1px solid ${acc.index === selectedIndex ? "var(--color-text-display)" : "var(--color-border-strong)"}`,
                  background: acc.index === selectedIndex ? "var(--color-text-display)" : "transparent",
                  color: acc.index === selectedIndex ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                {acc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {fromError ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          {fromError}
        </div>
      ) : (
        <RequestDetailRow label="From" value={`${accountName} · ${truncateId(identity, 10, 10)}`} />
      )}

      {error && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          {error}
        </div>
      )}

      <DappPolicyStatus decision={policyDecision} />

      <RequestActionBar>
        <Button variant="secondary" onClick={onReject} style={{ flex: 1 }}>
          Reject
        </Button>
        <Button onClick={approve} loading={processing} disabled={!wallet || !!fromError || !policyDecision.allowed} style={{ flex: 1 }}>
          Sign message
        </Button>
      </RequestActionBar>
    </div>
  );
}
