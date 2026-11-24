import { useMemo, useState } from "react";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { messageSigningIntent, signMessageFromSession, type SigningAuthorizationContext } from "@/lib/secure-session";
import { truncateId } from "@/lib/format";
import { base64ToBytes } from "@/lib/base64";
import { RequestApprovalActions, RequestDetailRow, RequestInlineNotice, RequestSigningAccountPicker } from "./request-primitives";
import { RequestMessageContent } from "./request-message-content";
import type { SignMessageRequest } from "@/lib/request-schema";
import type { SignMessageApproveResult } from "@/lib/request-approvals";

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

  const { account, wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const identity = account?.identity ?? "";
  const dataByteCount = useMemo(() => {
    if (!request.data) return null;
    try {
      return base64ToBytes(request.data).length;
    } catch {
      return null;
    }
  }, [request.data]);

  async function approve() {
    if (!account) return;
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0 }}>
      <RequestMessageContent
        title={request.data ? "Data to sign" : "Message"}
        data={request.data}
        message={request.message}
        dataByteCount={dataByteCount}
      />

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && wallet && (
        <RequestSigningAccountPicker
          accounts={wallet?.accounts ?? []}
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

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Sign message"
        approveLoading={processing}
        approveDisabled={!account || !!fromError}
      />
    </div>
  );
}
