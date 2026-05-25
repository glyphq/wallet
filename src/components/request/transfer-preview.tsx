import { useState } from "react";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useBalance } from "@/hooks/use-balance";
import { estimateTargetTick, getLatestTick } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildTransferFromSession } from "@/lib/secure-session";
import { useSigningAccount } from "@/hooks/use-signing-account";
import { isValidIdentity } from "@/lib/crypto";
import { truncateId, formatQu } from "@/lib/format";
import { exceedsHighValueThreshold } from "@/lib/session-policies";

export interface TransferRequest {
  to: string;
  amount: number | string;
  from?: string;
  tick_offset?: number;
  [key: string]: unknown;
}

export interface ApproveResult {
  txHash: string;
  targetTick: number;
  identity: string;
}

interface TransferPreviewProps {
  request: TransferRequest;
  onApprove: (result: ApproveResult) => void;
  onReject: () => void;
}

export function TransferPreview({ request, onApprove, onReject }: TransferPreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");

  const { wallet, accountName, fromError, selectedIndex, setSelectedIndex, showPicker } =
    useSigningAccount(request.from);
  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const vault = vaults.find((v) => v.id === settings.activeVaultId);
  const contacts = usePersistedStore((s) => s.contacts);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(wallet?.identity ?? null);

  const identity = wallet?.identity ?? "";
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
  const likelyFailures = [
    requestAmount === null ? "Malformed amount in the request body." : null,
    invalidDestination ? "Destination identity checksum is invalid." : null,
    insufficientBalance ? "Current account balance does not cover the requested transfer." : null,
    hasPendingTx ? "This account already has a pending transfer and cannot queue another one yet." : null,
  ].filter((item): item is string => !!item);

  async function approve() {
    if (!wallet || requestAmount === null) return;
    setProcessing(true);
    setTxError("");
    try {
      const amount = requestAmount;
      const currentTick = await getLatestTick();
      const tick = estimateTargetTick(currentTick, tickOffset);

      const { encoded, hash } = await buildTransferFromSession({
        accountIndex: selectedIndex,
        destination: request.to,
        amount,
        targetTick: tick,
        currentTick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: request.to,
        amount: amount.toString(),
        targetTick: tick,
        broadcastAt: Date.now(),
      });

      onApprove({ txHash: hash, targetTick: tick, identity });
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Broadcast failed.");
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Amount — primary element */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 300, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
          {formatQu(request.amount)}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)" }}>QU</div>
      </div>

      {/* Account picker (shown when dApp didn't specify `from`) */}
      {showPicker && vault && (
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
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
        <Row
          label="To"
          value={toContact ? `${toContact.name} · ${truncateId(request.to, 10, 10)}` : truncateId(request.to, 10, 10)}
        />
        <Row label="Target tick" value={targetTick ? String(targetTick) : "—"} />
        <Row label="Fee" value="None" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Preflight
        </div>
        <Row label="Balance before" value={balance !== null ? `${formatQu(balance)} QU` : "Loading…"} />
        <Row label="Balance after" value={projectedBalance !== null ? `${formatQu(projectedBalance)} QU` : "—"} />
        <Row label="Likely failures" value={likelyFailures.length > 0 ? likelyFailures.join(" ") : "No obvious client-side failure conditions detected."} />
      </div>

      {requestAmount === null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [INVALID AMOUNT]
        </div>
      )}
      {invalidDestination && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [INVALID DESTINATION IDENTITY]
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
            HIGH-VALUE TRANSFER CONFIRMED
          </span>
        </div>
      )}

      <Button onClick={approve} loading={processing} disabled={!wallet || requestAmount === null || !!fromError || invalidDestination || insufficientBalance || hasPendingTx || (needsHighValueConfirmation && !highValueConfirmed)}>
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
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.05em", textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}
