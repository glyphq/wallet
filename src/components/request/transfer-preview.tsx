import { useState } from "react";
import { Button } from "@/components/button";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { useTickInfo } from "@/hooks/use-tick-info";
import { estimateTargetTick, getRpcClient } from "@/lib/rpc";

export interface TransferRequest {
  to: string;
  amount: number;
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

function formatAmount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function truncate(id: string): string {
  if (!id || id.length <= 20) return id;
  return `${id.slice(0, 10)}...${id.slice(-10)}`;
}

export function TransferPreview({ request, onApprove, onReject }: TransferPreviewProps) {
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");

  const wallets = useSessionStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const contacts = usePersistedStore((s) => s.contacts);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const { data: tickInfo } = useTickInfo();

  // Prefer the wallet matching `from` hint; fall back to active account
  const wallet =
    (request.from ? wallets.find((w) => w.identity === request.from) : null) ??
    wallets[settings.activeAccountIndex] ??
    null;

  const identity = wallet?.identity ?? "";
  const accountName = vault?.accounts[settings.activeAccountIndex]?.name ?? "Account";
  const toContact = contacts.find((c) => c.identity === request.to);
  const tickOffset = request.tick_offset ?? 10;
  const targetTick = tickInfo ? estimateTargetTick(tickInfo.tick ?? 0, tickOffset) : null;

  async function approve() {
    if (!wallet || !tickInfo) return;
    setProcessing(true);
    setTxError("");
    try {
      const dest = request.to as Parameters<typeof wallet.buildTransfer>[0]["destination"];
      const amount = BigInt(request.amount);
      const tick = estimateTargetTick(tickInfo.tick ?? 0, tickOffset);

      const { encoded, hash } = await wallet.buildTransfer({
        destination: dest,
        amount,
        targetTick: tick,
        currentTick: tickInfo.tick,
      });

      const result = await getRpcClient().live.broadcastTransaction(encoded);
      if (!result.ok) throw result.error;

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
          {formatAmount(request.amount)}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)" }}>QU</div>
      </div>

      {/* Detail rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Row label="From" value={`${accountName} · ${truncate(identity)}`} />
        <Row
          label="To"
          value={toContact ? `${toContact.name} · ${truncate(request.to)}` : truncate(request.to)}
        />
        <Row label="Target tick" value={targetTick ? String(targetTick) : "—"} />
        <Row label="Fee" value="None" />
      </div>

      {txError && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [{txError}]
        </div>
      )}

      <Button onClick={approve} loading={processing} disabled={!wallet || !tickInfo}>
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
