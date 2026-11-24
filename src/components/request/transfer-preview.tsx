import { useState } from "react";
import { usePersistedStore } from "@/store/persisted";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useBalance } from "@/hooks/use-balance";
import { estimateTargetTick, fetchLatestTick } from "@/lib/api/network";
import { broadcastTx } from "@/lib/broadcast";
import { buildTransferFromSession, transactionSigningIntent } from "@/lib/secure-session";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { isValidIdentity } from "@/lib/crypto";
import { truncateId, formatQu } from "@/lib/format";
import { exceedsHighValueThreshold } from "@/lib/session-policies";
import {
  RequestApprovalActions,
  RequestCheckboxMark,
  RequestDetailRow,
  RequestInlineNotice,
  RequestSectionTitle,
  RequestSigningAccountPicker,
} from "./request-primitives";
import type { TransferRequest } from "@/lib/request-schema";
import type { TransactionPreviewProps } from "./request-preview-props";
import { DappPolicyStatus } from "@/components/dapp-policy-controls";
import { evaluateDappPermission } from "@/lib/dapp-permissions";
import { useReviewMode } from "@/screens/request/review-mode";

export type { TransferRequest } from "@/lib/request-schema";

export function TransferPreview({ request, onApprove, onReject, authorize }: TransactionPreviewProps<TransferRequest>) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");
  const { approvalWindow } = useReviewMode();

  const { account, wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const settings = usePersistedStore((s) => s.settings);
  const contacts = usePersistedStore((s) => s.contacts);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(account?.identity ?? null);

  const identity = account?.identity ?? "";
  const balance = balanceData?.balance ?? null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const requestAmount = (() => { try { return BigInt(request.amount); } catch { return null; } })();
  const insufficientBalance = balance !== null && requestAmount !== null && requestAmount > balance;
  const invalidDestination = !isValidIdentity(request.to);
  const toContact = contacts.find((c) => c.identity === request.to);
  const tickOffset = request.tick_offset ?? 10;
  const targetTick = tickInfo ? estimateTargetTick(tickInfo.tick ?? 0, tickOffset) : null;
  const [highValueConfirmed, setHighValueConfirmed] = useState(false);
  const needsHighValueConfirmation = requestAmount !== null && exceedsHighValueThreshold(requestAmount, settings.highValueSendThreshold);
  const projectedBalance = balance !== null && requestAmount !== null ? balance - requestAmount : null;
  const policyDecision = evaluateDappPermission({
    approvedDapps,
    origin: request.dapp.origin,
    permission: "transfer",
    identity,
    amountQu: requestAmount,
  });
  const likelyFailures = [
    requestAmount === null ? "Malformed amount in the request body." : null,
    policyDecision.reason,
    invalidDestination ? "Destination address checksum is invalid." : null,
    insufficientBalance ? "Current account balance does not cover the requested transfer." : null,
    hasPendingTx ? "This account already has a pending transfer and cannot queue another one yet." : null,
  ].filter((item): item is string => !!item);

  async function approve() {
    if (!account || requestAmount === null) return;
    const freshPolicyDecision = evaluateDappPermission({
      approvedDapps,
      origin: request.dapp.origin,
      permission: "transfer",
      identity,
      amountQu: requestAmount,
      now: Date.now(),
    });
    if (!freshPolicyDecision.allowed) {
      setTxError(freshPolicyDecision.reason ?? "dApp policy blocked this transfer.");
      return;
    }
    setProcessing(true);
    setTxError("");
    try {
      const amount = requestAmount;
      const currentTick = await fetchLatestTick();
      const tick = estimateTargetTick(currentTick, tickOffset);
      const authorization = await authorize(selectedIndex, transactionSigningIntent({
        accountIndex: selectedIndex,
        destination: request.to,
        amount,
        inputType: 0,
        payload: new Uint8Array(0),
      }));

      const { encoded, hash } = await buildTransferFromSession({
        accountIndex: selectedIndex,
        destination: request.to,
        amount,
        targetTick: tick,
        currentTick,
      }, authorization);

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: request.to,
        amount: amount.toString(),
        targetTick: tick,
        broadcastAt: Date.now(),
      });

      await onApprove({ txHash: hash, targetTick: tick, identity, accountIndex: selectedIndex }, authorization);
      setProcessing(false);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Broadcast failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: approvalWindow ? "var(--space-3)" : "var(--space-6)", flex: 1, minHeight: approvalWindow ? 0 : "100%" }}>
      {/* Amount — primary element */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 300, fontSize: approvalWindow ? 34 : "var(--text-display)", lineHeight: approvalWindow ? 1 : undefined, color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
          {formatQu(request.amount)}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)" }}>QU</div>
      </div>

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && wallet && (
        <RequestSigningAccountPicker
          accounts={wallet?.accounts ?? []}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      )}

      {/* fromError: dApp specified an identity not in this wallet */}
      {fromError && <RequestInlineNotice tone="error">{fromError}</RequestInlineNotice>}

      {/* Detail rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {!fromError && <RequestDetailRow label="From" value={`${accountName} · ${truncateId(identity, 10, 10)}`} />}
        <RequestDetailRow
          label="To"
          value={toContact ? `${toContact.name} · ${truncateId(request.to, 10, 10)}` : truncateId(request.to, 10, 10)}
        />
        {!approvalWindow && <RequestDetailRow label="Target tick" value={targetTick ? String(targetTick) : "—"} />}
        {!approvalWindow && <RequestDetailRow label="Fee" value="None" />}
      </div>

      {!approvalWindow && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <RequestSectionTitle>Preflight</RequestSectionTitle>
          <RequestDetailRow label="Balance before" value={balance !== null ? `${formatQu(balance)} QU` : "Loading…"} />
          <RequestDetailRow label="Balance after" value={projectedBalance !== null ? `${formatQu(projectedBalance)} QU` : "—"} />
          <RequestDetailRow label="Likely failures" value={likelyFailures.length > 0 ? likelyFailures.join(" ") : "No obvious client-side failure conditions detected."} />
        </div>
      )}

      {requestAmount === null && (
        <RequestInlineNotice tone="error">The request amount is invalid.</RequestInlineNotice>
      )}
      {invalidDestination && (
        <RequestInlineNotice tone="error">The destination address is invalid.</RequestInlineNotice>
      )}
      {insufficientBalance && (
        <RequestInlineNotice tone="error">The selected account does not have enough balance for this transfer.</RequestInlineNotice>
      )}
      {hasPendingTx && !insufficientBalance && (
        <RequestInlineNotice tone="warning">
          This account already has a pending transfer. Wait for confirmation before sending another one.
        </RequestInlineNotice>
      )}
      {txError && <RequestInlineNotice tone="error">{txError}</RequestInlineNotice>}

      {(!approvalWindow || !policyDecision.allowed) && <DappPolicyStatus decision={policyDecision} />}

      {needsHighValueConfirmation && (
        <button
          type="button"
          role="checkbox"
          aria-checked={highValueConfirmed}
          onClick={() => setHighValueConfirmed((value) => !value)}
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", userSelect: "none",
            width: "100%", padding: 0, border: "none", background: "transparent", textAlign: "left",
          }}
        >
          <RequestCheckboxMark checked={highValueConfirmed} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
            I understand this is a high-value transfer.
          </span>
        </button>
      )}

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Sign and send"
        approveLoading={processing}
        approveDisabled={!account || requestAmount === null || !!fromError || invalidDestination || insufficientBalance || hasPendingTx || !policyDecision.allowed || (needsHighValueConfirmation && !highValueConfirmed)}
      />
    </div>
  );
}
