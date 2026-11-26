import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { useBalance } from "@/hooks/use-balance";
import { estimateTargetTick, fetchLatestTick } from "@/lib/api/network";
import { getQutilSendManyFee } from "@/lib/api/contracts";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession, transactionSigningIntent } from "@/lib/secure-session";
import { contractIndexToIdentity } from "@qubic.org/crypto";
import type { Identity } from "@qubic.org/types";
import {
  QUTIL_CONTRACT_INDEX,
  QUTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  MSVAULT_CONTRACT_INDEX,
  MSVAULT_DEPOSIT_INPUT_TYPE,
  MSVAULT_RELEASE_TO_INPUT_TYPE,
  MSVAULT_RESET_RELEASE_INPUT_TYPE,
  CONTRACT_NAMES,
  CONTRACT_PROCEDURE_NAMES,
  decodeProcedureInputValues,
} from "@/lib/contracts";
import { truncateId, formatQu } from "@/lib/format";
import { base64ToBytes } from "@/lib/base64";
import type { DecodedValue } from "@glyph-oss/contracts";
import { Rocket01Icon } from "@/lib/icons";
import { qk } from "@/lib/query-keys";
import { RequestApprovalActions, RequestInlineNotice, RequestSigningAccountPicker } from "./request-primitives";
import { ApprovalAmount } from "./approval-amount";
import { ApprovalAddress } from "./approval-address";
import { ApprovalDisclosure, ApprovalField } from "./approval-field";
import { ScCallDecodedHeadline } from "./sc-call-decoded-views";
import {
  decodeMultiSignVaultDeposit,
  decodeMultiSignVaultRelease,
  decodeMultiSignVaultResetRelease,
  decodeQUtilSendToMany,
} from "./sc-call-decoders";
import type { TransactionPreviewProps } from "./request-preview-props";
import type { ScCallRequest } from "@/lib/request-schema";

export type { ScCallRequest } from "@/lib/request-schema";

function formatDecodedValue(value: DecodedValue): string {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `0x${Array.from(value).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (Array.isArray(value)) return value.map(formatDecodedValue).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested);
  return String(value);
}

export function ScCallPreview({ request, onApprove, onReject, authorize }: TransactionPreviewProps<ScCallRequest>) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");

  const { account, wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const apiIdentity = useApiCacheIdentity();
  const { data: balanceData } = useBalance(account?.identity ?? null);
  const { data: sendToManyFeeData } = useQuery({
    queryKey: qk.qutilSendManyFee(apiIdentity),
    queryFn: () => getQutilSendManyFee(),
    staleTime: 60_000,
    enabled: request.contract_index === QUTIL_CONTRACT_INDEX && request.input_type === QUTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  });

  const identity = account?.identity ?? "";
  const balance = balanceData?.balance ?? null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const requestAmount = (() => { try { return request.amount != null ? BigInt(request.amount) : 0n; } catch { return 0n; } })();
  const hasAmount = requestAmount > 0n;
  const sendToManyFee = sendToManyFeeData?.ok ? sendToManyFeeData.value.fee : null;
  const tickOffset = request.tick_offset ?? 10;
  const contractName = CONTRACT_NAMES[request.contract_index] ?? `Contract #${request.contract_index}`;
  const procedureName = CONTRACT_PROCEDURE_NAMES[`${request.contract_index}:${request.input_type}`] ?? "Unknown procedure";
  const destination: Identity = contractIndexToIdentity(request.contract_index);
  const payloadBytes = useMemo(
    () => (request.payload ? base64ToBytes(request.payload) : new Uint8Array(0)),
    [request.payload],
  );
  const decodedInput = useMemo(
    () => decodeProcedureInputValues(request.contract_index, request.input_type, payloadBytes),
    [request.contract_index, request.input_type, payloadBytes],
  );
  const decodedMultiSigDeposit = useMemo(() => {
    if (request.contract_index === MSVAULT_CONTRACT_INDEX && request.input_type === MSVAULT_DEPOSIT_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeMultiSignVaultDeposit(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);
  const decodedMultiSigRelease = useMemo(() => {
    if (request.contract_index === MSVAULT_CONTRACT_INDEX && request.input_type === MSVAULT_RELEASE_TO_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeMultiSignVaultRelease(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);
  const decodedMultiSigResetRelease = useMemo(() => {
    if (request.contract_index === MSVAULT_CONTRACT_INDEX && request.input_type === MSVAULT_RESET_RELEASE_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeMultiSignVaultResetRelease(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);

  // Decoded views for known call types
  const decodedSendToMany = useMemo(() => {
    if (request.contract_index === QUTIL_CONTRACT_INDEX && request.input_type === QUTIL_SEND_TO_MANY_V1_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeQUtilSendToMany(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);

  const recipientsTotal = decodedSendToMany?.reduce((sum, recipient) => sum + recipient.amount, 0n) ?? 0n;
  const contractFee = decodedSendToMany ? sendToManyFee : null;
  const projectedBalance = balance !== null ? balance - requestAmount : null;
  const qUtilAmountWarning = decodedSendToMany && contractFee !== null && balance !== null && requestAmount > 0n && requestAmount !== recipientsTotal + contractFee
    ? "Attached amount does not match recipient total plus the current QUtil fee."
    : decodedSendToMany && contractFee === null
      ? "Could not fetch the current QUtil fee estimate."
      : null;
  const insufficientBalance = balance !== null && requestAmount > balance;

  async function approve() {
    if (!account) return;
    setProcessing(true);
    setTxError("");
    try {
      const amount = requestAmount;
      const currentTick = await fetchLatestTick();
      const tick = estimateTargetTick(currentTick, tickOffset);
      const authorization = await authorize(selectedIndex, transactionSigningIntent({
        accountIndex: selectedIndex,
        destination,
        amount,
        inputType: request.input_type,
        payload: payloadBytes,
      }));

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: selectedIndex,
        destination,
        inputType: request.input_type,
        payload: payloadBytes,
        amount,
        targetTick: tick,
        currentTick,
      }, authorization);

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: destination as string,
        amount: amount.toString(),
        targetTick: tick,
        broadcastAt: Date.now(),
        contractName: `${contractName} · ${procedureName}`,
      });

      await onApprove({ txHash: hash, targetTick: tick, identity, accountIndex: selectedIndex }, authorization);
      setProcessing(false);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Broadcast failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1, minHeight: 0 }}>
      {hasAmount ? <ApprovalAmount amount={requestAmount} /> : null}

      {showPicker && wallet ? (
        <RequestSigningAccountPicker
          accounts={wallet.accounts}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      ) : null}

      {fromError ? <RequestInlineNotice tone="error">{fromError}</RequestInlineNotice> : null}

      {!fromError ? <ApprovalAddress label="From" identity={identity} name={accountName} compact="short" /> : null}

      <ApprovalField label="Contract">
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-compact)", color: "var(--color-text-primary)" }}>{contractName}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.04em", color: "var(--color-text-tertiary)" }}>({truncateId(destination as string, 8, 8)})</span>
      </ApprovalField>

      <ApprovalField label="Procedure">
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-compact)", color: "var(--color-text-primary)" }}>{procedureName}</span>
      </ApprovalField>

      {decodedInput ? (
        <ApprovalDisclosure label="Decoded input">
          {Object.entries(decodedInput).map(([field, value]) => (
            <ApprovalField key={field} label={field}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.03em", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
                {formatDecodedValue(value)}
              </span>
            </ApprovalField>
          ))}
        </ApprovalDisclosure>
      ) : null}

      <ScCallDecodedHeadline
        decodedMultiSigDeposit={decodedMultiSigDeposit}
        decodedMultiSigRelease={decodedMultiSigRelease}
        decodedMultiSigResetRelease={decodedMultiSigResetRelease}
      />

      {decodedSendToMany ? (
        <ApprovalField label="Recipients">
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>{decodedSendToMany.length} recipients</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>· {formatQu(recipientsTotal)} QUBIC</span>
        </ApprovalField>
      ) : null}

      {hasAmount && projectedBalance !== null ? (
        <ApprovalField label="Remaining balance">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)", letterSpacing: "0.03em" }}>{formatQu(projectedBalance)} QUBIC</span>
        </ApprovalField>
      ) : null}

      {insufficientBalance ? <RequestInlineNotice tone="error">The selected account does not have enough balance for this request.</RequestInlineNotice> : null}
      {hasPendingTx && !insufficientBalance ? <RequestInlineNotice tone="warning">This account already has a pending transfer. Wait for confirmation before sending another one.</RequestInlineNotice> : null}
      {qUtilAmountWarning ? <RequestInlineNotice tone="warning">{qUtilAmountWarning}</RequestInlineNotice> : null}
      {txError ? <RequestInlineNotice tone="error">{txError}</RequestInlineNotice> : null}

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Sign and send"
        approveIcon={<Rocket01Icon size={16} aria-hidden="true" />}
        approveLoading={processing}
        approveDisabled={!account || !!fromError || insufficientBalance || hasPendingTx}
      />
    </div>
  );
}
