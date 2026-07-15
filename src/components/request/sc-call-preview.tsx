import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";
import { useBalance } from "@/hooks/use-balance";
import { estimateTargetTick, getLatestTick, getRpcClient } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { contractIndexToIdentity, publicKeyToIdentity } from "@qubic.org/crypto";
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
import type { ApproveResult } from "./transfer-preview";
import { truncateId, formatQu } from "@/lib/format";
import { exceedsHighValueThreshold } from "@/lib/session-policies";
import { qk } from "@/lib/query-keys";
import type { ScCallRequest } from "@/lib/request-schema";

export type { ScCallRequest } from "@/lib/request-schema";

interface ScCallPreviewProps {
  request: ScCallRequest;
  onApprove: (result: ApproveResult) => void;
  onReject: () => void;
}


function base64ToHex(b64: string): string {
  try {
    const binary = atob(b64);
    return Array.from(binary, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
  } catch {
    return "[invalid payload]";
  }
}

function base64ToBytes(b64: string): Uint8Array {
  try {
    const binary = atob(b64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readU64(view: DataView, offset: number): bigint {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return (BigInt(hi) << 32n) | BigInt(lo);
}

// Decode QUtil SendToManyV1 payload: 25×32-byte pubkeys + 25×8-byte uint64 amounts (LE)
function decodeQUtilSendToMany(bytes: Uint8Array): { identity: string; amount: bigint }[] | null {
  if (bytes.length !== 800 + 200) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const results: { identity: string; amount: bigint }[] = [];
  for (let i = 0; i < 25; i++) {
    const pubKey = bytes.slice(i * 32, (i + 1) * 32);
    const amountOffset = 800 + i * 8;
    const amount = readU64(view, amountOffset);
    if (amount === 0n) continue;
    try {
      const identity = publicKeyToIdentity(pubKey) as string;
      results.push({ identity, amount });
    } catch {
      // skip invalid entries
    }
  }
  return results;
}

// Decode Qearn UnlockInQearn payload: 8-byte uint64 amount + 4-byte uint32 epoch (LE)
function decodeQearnUnlock(bytes: Uint8Array): { amount: bigint; epoch: number } | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const amount = readU64(view, 0);
  const epoch = readU32(view, 8);
  return { amount, epoch };
}

function decodeMultiSignVaultDeposit(bytes: Uint8Array): { vaultId: bigint } | null {
  if (bytes.length < 8) return null;
  return { vaultId: readU64(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0) };
}

function decodeMultiSignVaultResetRelease(bytes: Uint8Array): { vaultId: bigint } | null {
  if (bytes.length < 8) return null;
  return { vaultId: readU64(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0) };
}

function decodeMultiSignVaultRelease(bytes: Uint8Array): { vaultId: bigint; amount: bigint; destination: string } | null {
  if (bytes.length < 48) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    return {
      vaultId: readU64(view, 0),
      amount: readU64(view, 8),
      destination: publicKeyToIdentity(bytes.slice(16, 48)) as string,
    };
  } catch {
    return null;
  }
}

export function ScCallPreview({ request, onApprove, onReject }: ScCallPreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");
  const [showPayload, setShowPayload] = useState(false);
  const [highValueConfirmed, setHighValueConfirmed] = useState(false);

  const { wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const vault = vaults.find((v) => v.id === settings.activeVaultId);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
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
  const estimatedContractFeeComponent = decodedSendToMany
    ? contractFee
    : null;
  const likelyFailures = [
    fromError || null,
    balance !== null && requestAmount > balance ? "Current account balance does not cover the attached QU amount." : null,
    decodedSendToMany && contractFee !== null && balance !== null && requestAmount > 0n && requestAmount !== recipientsTotal + contractFee
      ? "Attached amount does not match recipient total plus the current QUtil fee."
      : null,
    decodedSendToMany && contractFee === null ? "Could not fetch the current QUtil fee estimate." : null,
    hasPendingTx ? "This account already has a pending transaction and cannot queue another one yet." : null,
  ].filter((item): item is string => !!item);
  const insufficientBalance = balance !== null && requestAmount > balance;
  const balanceAfterDisplay = projectedBalance !== null ? `${formatQu(projectedBalance)} QU` : "—";

  async function approve() {
    if (!wallet) return;
    setProcessing(true);
    setTxError("");
    try {
      const amount = requestAmount;
      const currentTick = await getLatestTick();
      const tick = estimateTargetTick(currentTick, tickOffset);

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: selectedIndex,
        destination,
        inputType: request.input_type,
        payload: payloadBytes,
        amount,
        targetTick: tick,
        currentTick,
      });

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

      onApprove({ txHash: hash, targetTick: tick, identity });
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Broadcast failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Contract — primary element */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 300, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {contractName}
        </div>
        <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
          {inputTypeLabel}
        </div>
        {hasAmount && (
          <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)" }}>
            {formatQu(requestAmount)} QU
          </div>
        )}
      </div>

      {/* ── Decoded: QUtil SendToMany ── */}
      {decodedSendToMany && decodedSendToMany.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            Recipients ({decodedSendToMany.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", maxHeight: 180, overflowY: "auto" }}>
            {decodedSendToMany.map((r) => (
              <div key={r.identity} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.03em" }}>
                  {truncateId(r.identity, 10, 10)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {formatQu(r.amount)} QU
                </span>
              </div>
            ))}
          </div>
          {decodedSendToMany.length > 4 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", textAlign: "right" }}>
              scroll ↑↓ to see all {decodedSendToMany.length}
            </div>
          )}
        </div>
      )}

      {/* ── Decoded: Qearn Lock ── */}
      {isQearnLock && hasAmount && (
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          LOCK {formatQu(requestAmount)} QU FOR STAKING
        </div>
      )}

      {isQUtilBurn && hasAmount && (
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          BURN {formatQu(requestAmount)} QU PERMANENTLY
        </div>
      )}

      {/* ── Decoded: Qearn Unlock ── */}
      {decodedQearnUnlock && (
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          UNLOCK {formatQu(decodedQearnUnlock.amount)} QU FROM EPOCH {decodedQearnUnlock.epoch}
        </div>
      )}

      {decodedMultiSigDeposit && (
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          DEPOSIT INTO MS VAULT #{decodedMultiSigDeposit.vaultId.toString()}
        </div>
      )}

      {decodedMultiSigRelease && (
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          RELEASE {formatQu(decodedMultiSigRelease.amount)} QU FROM MS VAULT #{decodedMultiSigRelease.vaultId.toString()} TO {truncateId(decodedMultiSigRelease.destination, 10, 10)}
        </div>
      )}

      {decodedMultiSigResetRelease && (
        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          RESET PENDING RELEASE FOR MS VAULT #{decodedMultiSigResetRelease.vaultId.toString()}
        </div>
      )}

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && vault && (
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
            Sign as
          </div>
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

      {/* fromError: dApp specified an identity not in this vault */}
      {fromError && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [{fromError}]
        </div>
      )}

      {/* Detail rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {!fromError && <Row label="From" value={`${accountName} · ${truncateId(identity, 10, 10)}`} />}
        <Row label="To" value={truncateId(destination as string, 10, 10)} />
        {hasAmount && <Row label="Amount" value={`${formatQu(requestAmount)} QU`} />}
        <Row label="Target tick" value={targetTick ? String(targetTick) : "—"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          Preflight
        </div>
        <Row label="Balance before" value={balance !== null ? `${formatQu(balance)} QU` : "Loading…"} />
        <Row label="Balance after" value={balanceAfterDisplay} />
        {decodedSendToMany && (
          <>
            <Row label="Recipient total" value={`${formatQu(recipientsTotal)} QU`} />
            <Row label="Contract fee" value={estimatedContractFeeComponent !== null ? `${formatQu(estimatedContractFeeComponent)} QU` : "Unavailable"} />
          </>
        )}
        <Row label="Likely failures" value={likelyFailures.length > 0 ? likelyFailures.join(" ") : "No obvious client-side failure conditions detected."} />
      </div>

      {/* Payload — collapsible raw hex (always available for verification) */}
      {payloadHex !== null && (
        <div>
          <button
            onClick={() => setShowPayload((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
              {showPayload ? "[HIDE PAYLOAD]" : `[SHOW PAYLOAD · ${payloadByteCount}B]`}
            </span>
          </button>
          {showPayload && (
            <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", wordBreak: "break-all", lineHeight: 1.6 }}>
              {payloadHex}
            </div>
          )}
        </div>
      )}

      {insufficientBalance && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [INSUFFICIENT BALANCE]
        </div>
      )}
      {hasPendingTx && !insufficientBalance && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
          [TRANSFER PENDING — WAIT FOR CONFIRMATION]
        </div>
      )}
      {txError && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [{txError}]
        </div>
      )}

      {needsHighValueConfirmation && (
        <div
          role="checkbox"
          aria-checked={highValueConfirmed}
          tabIndex={0}
          onClick={() => setHighValueConfirmed((value) => !value)}
          onKeyDown={(e) => e.key === " " && setHighValueConfirmed((value) => !value)}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", userSelect: "none" }}
        >
          <div style={{
            width: 14, height: 14, flexShrink: 0,
            border: `1px solid ${highValueConfirmed ? "var(--color-text-display)" : "var(--color-border-strong)"}`,
            borderRadius: 2,
            background: highValueConfirmed ? "var(--color-text-display)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {highValueConfirmed && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-bg-base)", lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
            HIGH-VALUE CALL CONFIRMED
          </span>
        </div>
      )}

      <Button onClick={approve} loading={processing} disabled={!wallet || !tickInfo || !!fromError || insufficientBalance || hasPendingTx || (needsHighValueConfirmation && !highValueConfirmed)}>
        Sign and send
      </Button>
      <Button variant="danger" shape="sharp" onClick={onReject}>
        Reject
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.05em", textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}
