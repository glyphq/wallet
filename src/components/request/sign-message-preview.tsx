import { useState } from "react";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { signMessageFromSession } from "@/lib/secure-session";
import { truncateId } from "@/lib/format";
import { RequestActionBar, RequestDetailRow, RequestSectionTitle, RequestTechnicalBlock } from "./request-primitives";
import type { SignMessageRequest } from "@/lib/request-schema";

export type { SignMessageRequest } from "@/lib/request-schema";

export interface SignMessageApproveResult {
  signature: string; // base64-encoded 64-byte SchnorrQ signature
  publicKey: string; // base64-encoded 32-byte public key
  identity: string;
}

interface SignMessagePreviewProps {
  request: SignMessageRequest;
  onApprove: (result: SignMessageApproveResult) => void;
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

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function SignMessagePreview({ request, onApprove, onReject }: SignMessagePreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const { wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const vault = usePersistedStore((s) =>
    s.vaults.find((v) => v.id === s.settings.activeVaultId)
  );
  async function approve() {
    if (!wallet) return;
    setProcessing(true);
    setError("");
    try {
      const messageBytes = request.data
        ? base64ToBytes(request.data)
        : new TextEncoder().encode(request.message);
      const { signature, publicKey, identity } = await signMessageFromSession(selectedIndex, messageBytes);
      onApprove({
        signature: bytesToBase64(signature),
        publicKey: bytesToBase64(publicKey),
        identity,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signing failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        This is an off-chain signature. No transaction will be broadcast.
      </div>

      <div>
        <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Message</RequestSectionTitle></div>
        <RequestTechnicalBlock>
          {request.message.length > 2000
            ? `${request.message.slice(0, 2000)}\n\n[… ${request.message.length.toLocaleString()} chars total]`
            : request.message}
        </RequestTechnicalBlock>
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
        <RequestDetailRow label="From" value={`${accountName} · ${truncateId(wallet?.identity ?? "", 10, 10)}`} />
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
        <Button onClick={approve} loading={processing} disabled={!wallet || !!fromError} style={{ flex: 1 }}>
          Sign message
        </Button>
      </RequestActionBar>
    </div>
  );
}
