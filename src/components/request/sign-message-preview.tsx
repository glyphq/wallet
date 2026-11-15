import { useMemo, useState } from "react";
import { usePersistedStore } from "@/store/persisted";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { messageSigningIntent, signMessageFromSession, type SigningAuthorizationContext } from "@/lib/secure-session";
import { truncateId } from "@/lib/format";
import { base64ToBytes } from "@/lib/base64";
import { RequestApprovalActions, RequestDetailRow, RequestInlineNotice, RequestSigningAccountPicker } from "./request-primitives";
import { RequestMessageContent } from "./request-message-content";
import type { SignMessageRequest } from "@/lib/request-schema";
import type { SignMessageApproveResult } from "@/lib/request-approvals";
import { DappPolicyStatus } from "@/components/dapp-policy-controls";
import { evaluateDappPermission } from "@/lib/dapp-permissions";

export type { SignMessageRequest } from "@/lib/request-schema";

interface SignMessagePreviewProps {
  request: SignMessageRequest;
  onApprove: (result: SignMessageApproveResult, authorization: SigningAuthorizationContext) => void | Promise<void>;
  authorize: (accountIndex: number, intent: string) => Promise<SigningAuthorizationContext>;
  onReject: () => void;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function SignMessagePreview({ request, onApprove, onReject, authorize }: SignMessagePreviewProps) {
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
      const authorization = await authorize(selectedIndex, messageSigningIntent(selectedIndex, messageBytes));
      const { signature, publicKey, identity: signingIdentity } = await signMessageFromSession(selectedIndex, messageBytes, authorization);
      await onApprove({
        signature: bytesToBase64(signature),
        publicKey: bytesToBase64(publicKey),
        identity: signingIdentity,
        accountIndex: selectedIndex,
      }, authorization);
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signing failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      <RequestMessageContent
        title={request.data ? "Data to sign" : "Message"}
        data={request.data}
        message={request.message}
        dataByteCount={dataByteCount}
      />

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && vault && (
        <RequestSigningAccountPicker
          accounts={vault.accounts}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      )}

      {fromError ? (
        <RequestInlineNotice tone="error">{fromError}</RequestInlineNotice>
      ) : (
        <RequestDetailRow label="From" value={`${accountName} · ${truncateId(identity, 10, 10)}`} />
      )}

      {error && <RequestInlineNotice tone="error">{error}</RequestInlineNotice>}

      <DappPolicyStatus decision={policyDecision} />

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Sign message"
        approveLoading={processing}
        approveDisabled={!wallet || !!fromError || !policyDecision.allowed}
      />
    </div>
  );
}
