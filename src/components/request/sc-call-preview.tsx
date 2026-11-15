import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";
import { useBalance } from "@/hooks/use-balance";
import { estimateTargetTick, getLatestTick, getRpcClient } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession, transactionSigningIntent } from "@/lib/secure-session";
import { contractIndexToIdentity } from "@qubic.org/crypto";
import type { Identity } from "@qubic.org/types";
import {
  Q_UTIL_CONTRACT_INDEX,
  Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  Q_UTIL_BURN_QUBIC_INPUT_TYPE,
  qUtilGetSendToManyV1Fee,
  QEARN_CONTRACT_INDEX,
  QEARN_LOCK_INPUT_TYPE,
  MS_VAULT_CONTRACT_INDEX,
  MS_VAULT_DEPOSIT_INPUT_TYPE,
  MS_VAULT_RELEASE_TO_INPUT_TYPE,
  MS_VAULT_RESET_RELEASE_INPUT_TYPE,
  CONTRACT_NAMES,
  CONTRACT_PROCEDURE_NAMES,
} from "@/lib/contracts";
import { QEARN_UNLOCK_INPUT_TYPE } from "@qubic.org/contracts";
import { truncateId, formatQu } from "@/lib/format";
import { exceedsHighValueThreshold } from "@/lib/session-policies";
import { base64ToBytes } from "@/lib/base64";
import { qk } from "@/lib/query-keys";
import {
  RequestApprovalActions,
  RequestCheckboxMark,
  RequestDetailRow,
  RequestInlineNotice,
  RequestSectionTitle,
  RequestSigningAccountPicker,
} from "./request-primitives";
import { ScCallAdvancedDetails } from "./sc-call-advanced-details";
import { ScCallContractSummary } from "./sc-call-contract-summary";
import { ScCallDecodedHeadline, ScCallRecipients } from "./sc-call-decoded-views";
import {
  base64ToHex,
  decodeMultiSignVaultDeposit,
  decodeMultiSignVaultRelease,
  decodeMultiSignVaultResetRelease,
  decodeQearnUnlock,
  decodeQUtilSendToMany,
} from "./sc-call-decoders";
import type { TransactionPreviewProps } from "./request-preview-props";
import type { ScCallRequest } from "@/lib/request-schema";
import { DappPolicyStatus } from "@/components/dapp-policy-controls";
import { evaluateDappPermission } from "@/lib/dapp-permissions";

export type { ScCallRequest } from "@/lib/request-schema";

export function ScCallPreview({ request, onApprove, onReject, authorize }: TransactionPreviewProps<ScCallRequest>) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");
  const [highValueConfirmed, setHighValueConfirmed] = useState(false);

  const { wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const vault = vaults.find((v) => v.id === settings.activeVaultId);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const { data: tickInfo } = useTickInfo();
  const rpcIdentity = useRpcCacheIdentity("live");
  const { data: balanceData } = useBalance(wallet?.identity ?? null);
  const { data: sendToManyFeeData } = useQuery({
    queryKey: qk.qutilSendManyFee(rpcIdentity),
    queryFn: () => qUtilGetSendToManyV1Fee(getRpcClient().live),
    staleTime: 60_000,
    enabled: request.contract_index === Q_UTIL_CONTRACT_INDEX && request.input_type === Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  });

  const identity = wallet?.identity ?? "";
  const balance = balanceData?.balance ?? null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const requestAmount = (() => { try { return request.amount != null ? BigInt(request.amount) : 0n; } catch { return 0n; } })();
  const hasAmount = requestAmount > 0n;
  const sendToManyFee = sendToManyFeeData?.ok ? sendToManyFeeData.value.fee : null;
  const tickOffset = request.tick_offset ?? 10;
  const targetTick = tickInfo ? estimateTargetTick(tickInfo.tick ?? 0, tickOffset) : null;
  const needsHighValueConfirmation = requestAmount > 0n && exceedsHighValueThreshold(requestAmount, settings.highValueSendThreshold);
  const contractName = CONTRACT_NAMES[request.contract_index] ?? `Contract #${request.contract_index}`;
  const inputTypeLabel = CONTRACT_PROCEDURE_NAMES[`${request.contract_index}:${request.input_type}`] ?? `Procedure ${request.input_type}`;
  const destination: Identity = contractIndexToIdentity(request.contract_index);
  const payloadBytes = useMemo(
    () => (request.payload ? base64ToBytes(request.payload) : new Uint8Array(0)),
    [request.payload],
  );
  const payloadHex = request.payload ? base64ToHex(request.payload) : null;
  const payloadByteCount = payloadBytes.length;
  const decodedMultiSigDeposit = useMemo(() => {
    if (request.contract_index === MS_VAULT_CONTRACT_INDEX && request.input_type === MS_VAULT_DEPOSIT_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeMultiSignVaultDeposit(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);
  const decodedMultiSigRelease = useMemo(() => {
    if (request.contract_index === MS_VAULT_CONTRACT_INDEX && request.input_type === MS_VAULT_RELEASE_TO_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeMultiSignVaultRelease(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);
  const decodedMultiSigResetRelease = useMemo(() => {
    if (request.contract_index === MS_VAULT_CONTRACT_INDEX && request.input_type === MS_VAULT_RESET_RELEASE_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeMultiSignVaultResetRelease(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);

  // Decoded views for known call types
  const decodedSendToMany = useMemo(() => {
    if (request.contract_index === Q_UTIL_CONTRACT_INDEX && request.input_type === Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeQUtilSendToMany(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);

  const decodedQearnUnlock = useMemo(() => {
    if (request.contract_index === QEARN_CONTRACT_INDEX && request.input_type === QEARN_UNLOCK_INPUT_TYPE && payloadBytes.length > 0) {
      return decodeQearnUnlock(payloadBytes);
    }
    return null;
  }, [request.contract_index, request.input_type, payloadBytes]);

  const isQearnLock = request.contract_index === QEARN_CONTRACT_INDEX && request.input_type === QEARN_LOCK_INPUT_TYPE;
  const isQUtilBurn = request.contract_index === Q_UTIL_CONTRACT_INDEX && request.input_type === Q_UTIL_BURN_QUBIC_INPUT_TYPE;
  const recipientsTotal = decodedSendToMany?.reduce((sum, recipient) => sum + recipient.amount, 0n) ?? 0n;
  const contractFee = decodedSendToMany ? sendToManyFee : null;
  const projectedBalance = balance !== null ? balance - requestAmount : null;
  const qUtilAmountWarning = decodedSendToMany && contractFee !== null && balance !== null && requestAmount > 0n && requestAmount !== recipientsTotal + contractFee
    ? "Attached amount does not match recipient total plus the current QUtil fee."
    : decodedSendToMany && contractFee === null
      ? "Could not fetch the current QUtil fee estimate."
      : null;
  const insufficientBalance = balance !== null && requestAmount > balance;
  const balanceAfterDisplay = projectedBalance !== null ? `${formatQu(projectedBalance)} QU` : "—";
  const policyDecision = evaluateDappPermission({
    approvedDapps,
    origin: request.dapp.origin,
    permission: "sc_call",
    identity,
    amountQu: requestAmount,
  });

  async function approve() {
    if (!wallet) return;
    const freshPolicyDecision = evaluateDappPermission({
      approvedDapps,
      origin: request.dapp.origin,
      permission: "sc_call",
      identity,
      amountQu: requestAmount,
      now: Date.now(),
    });
    if (!freshPolicyDecision.allowed) {
      setTxError(freshPolicyDecision.reason ?? "dApp policy blocked this contract call.");
      return;
    }
    setProcessing(true);
    setTxError("");
    try {
      const amount = requestAmount;
      const currentTick = await getLatestTick();
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
        contractName: `${contractName} · ${inputTypeLabel}`,
      });

      await onApprove({ txHash: hash, targetTick: tick, identity, accountIndex: selectedIndex }, authorization);
      setProcessing(false);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Broadcast failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      {/* Contract — primary element */}
      <ScCallContractSummary
        contractName={contractName}
        inputTypeLabel={inputTypeLabel}
        amountQu={hasAmount ? formatQu(requestAmount) : null}
      />

      {decodedSendToMany && <ScCallRecipients recipients={decodedSendToMany} />}

      <ScCallDecodedHeadline
        requestAmount={requestAmount}
        hasAmount={hasAmount}
        isQearnLock={isQearnLock}
        isQUtilBurn={isQUtilBurn}
        decodedQearnUnlock={decodedQearnUnlock}
        decodedMultiSigDeposit={decodedMultiSigDeposit}
        decodedMultiSigRelease={decodedMultiSigRelease}
        decodedMultiSigResetRelease={decodedMultiSigResetRelease}
      />

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && vault && (
        <RequestSigningAccountPicker
          accounts={vault.accounts}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      )}

      {/* fromError: dApp specified an identity not in this vault */}
      {fromError && <RequestInlineNotice tone="error">{fromError}</RequestInlineNotice>}

      {/* Detail rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {!fromError && <RequestDetailRow label="From" value={`${accountName} · ${truncateId(identity, 10, 10)}`} />}
        <RequestDetailRow label="To" value={truncateId(destination as string, 10, 10)} />
        {hasAmount && <RequestDetailRow label="Balance after" value={balanceAfterDisplay} />}
      </div>

      {decodedSendToMany && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <RequestSectionTitle>Totals</RequestSectionTitle>
          <RequestDetailRow label="Recipients" value={`${formatQu(recipientsTotal)} QU`} />
          <RequestDetailRow label="QUtil fee" value={contractFee !== null ? `${formatQu(contractFee)} QU` : "Unavailable"} />
        </div>
      )}

      {(payloadHex !== null || targetTick !== null) && (
        <ScCallAdvancedDetails
          payloadHex={payloadHex}
          payloadByteCount={payloadByteCount}
          targetTick={targetTick}
        />
      )}

      {insufficientBalance && (
        <RequestInlineNotice tone="error">The selected account does not have enough balance for this request.</RequestInlineNotice>
      )}
      {hasPendingTx && !insufficientBalance && (
        <RequestInlineNotice tone="warning">
          This account already has a pending transfer. Wait for confirmation before sending another one.
        </RequestInlineNotice>
      )}
      {qUtilAmountWarning && <RequestInlineNotice tone="warning">{qUtilAmountWarning}</RequestInlineNotice>}
      {txError && <RequestInlineNotice tone="error">{txError}</RequestInlineNotice>}

      <DappPolicyStatus decision={policyDecision} />

      {needsHighValueConfirmation && (
        <div
          role="checkbox"
          aria-checked={highValueConfirmed}
          tabIndex={0}
          onClick={() => setHighValueConfirmed((value) => !value)}
          onKeyDown={(e) => e.key === " " && setHighValueConfirmed((value) => !value)}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", userSelect: "none" }}
        >
          <RequestCheckboxMark checked={highValueConfirmed} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
            I understand this is a high-value contract call.
          </span>
        </div>
      )}

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Sign and send"
        approveLoading={processing}
        approveDisabled={!wallet || !tickInfo || !!fromError || insufficientBalance || hasPendingTx || !policyDecision.allowed || (needsHighValueConfirmation && !highValueConfirmed)}
      />
    </div>
  );
}
