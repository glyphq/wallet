import { useState } from "react";
import { usePersistedStore } from "@/store/persisted";
import { useBalance } from "@/hooks/use-balance";
import { estimateTargetTick, fetchLatestTick } from "@/lib/api/network";
import { broadcastTx } from "@/lib/broadcast";
import { buildTransferFromSession, transactionSigningIntent } from "@/lib/secure-session";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { isValidIdentity } from "@/lib/crypto";
import { formatQu } from "@/lib/format";
import { RequestApprovalActions, RequestInlineNotice, RequestSigningAccountPicker } from "./request-primitives";
import { ApprovalAddress } from "./approval-address";
import { ApprovalAmount } from "./approval-amount";
import { MoneySend01Icon } from "@/lib/icons";
import type { TransferRequest } from "@/lib/request-schema";
import type { TransactionPreviewProps } from "./request-preview-props";

export type { TransferRequest } from "@/lib/request-schema";



export function TransferPreview({ request, onApprove, onReject, authorize }: TransactionPreviewProps<TransferRequest>) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");

  const { account, wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } = useSigningAccount(request.from);
  const contacts = usePersistedStore((s) => s.contacts);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const { data: balanceData } = useBalance(account?.identity ?? null);

  const identity = account?.identity ?? "";
  const balance = balanceData?.balance ?? null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const requestAmount = (() => { try { return BigInt(request.amount); } catch { return null; } })();
  const insufficientBalance = balance !== null && requestAmount !== null && requestAmount > balance;
  const invalidDestination = !isValidIdentity(request.to);
  const toContact = contacts.find((c) => c.identity === request.to);
  const tickOffset = request.tick_offset ?? 10;
  const projectedBalance = balance !== null && requestAmount !== null ? balance - requestAmount : null;

  async function approve() {
    if (!account || requestAmount === null) return;
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
        broadcastTick: currentTick,
      });

      await onApprove({ txHash: hash, targetTick: tick, identity, accountIndex: selectedIndex }, authorization);
      setProcessing(false);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Broadcast failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: 0 }}>
      <ApprovalAmount amount={requestAmount} />

      {showPicker && wallet ? (
        <RequestSigningAccountPicker
          accounts={wallet.accounts}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      ) : null}

      {fromError ? <RequestInlineNotice tone="error">{fromError}</RequestInlineNotice> : null}

      {!fromError ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <ApprovalAddress label="From" identity={identity} name={accountName} compact="short" />
          <ApprovalAddress label="To" identity={request.to} name={toContact?.name} compact="long" />
        </div>
      ) : null}

      {projectedBalance !== null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>Remaining balance</span>
          <span title={`${formatQu(projectedBalance)} QUBIC`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)", letterSpacing: "0.03em" }}>
            {formatQu(projectedBalance)} QUBIC
          </span>
        </div>
      ) : null}

      {requestAmount === null ? <RequestInlineNotice tone="error">The request amount is invalid.</RequestInlineNotice> : null}
      {invalidDestination ? <RequestInlineNotice tone="error">The destination address is invalid.</RequestInlineNotice> : null}
      {insufficientBalance ? <RequestInlineNotice tone="error">The selected account does not have enough balance for this transfer.</RequestInlineNotice> : null}
      {hasPendingTx && !insufficientBalance ? (
        <RequestInlineNotice tone="warning">This account already has a pending transfer. Wait for confirmation before sending another one.</RequestInlineNotice>
      ) : null}
      {txError ? <RequestInlineNotice tone="error">{txError}</RequestInlineNotice> : null}

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Send"
        approveIcon={<MoneySend01Icon size={16} aria-hidden="true" />}
        approveLoading={processing}
        approveDisabled={!account || requestAmount === null || !!fromError || invalidDestination || insufficientBalance || hasPendingTx}
      />
    </div>
  );
}
