import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AltArrowLeft, UserId, Wallet, ClockCircle, Bolt, ArrowRightUp, NotesMinimalistic, ShieldCheck, ShieldWarning } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTickInfo } from "@/hooks/use-tick-info";
import { type TxHistoryItem } from "@/hooks/use-tx-history";
import { KNOWN_CONTRACT_ADDRESSES, CONTRACT_PROCEDURE_NAMES, CONTRACT_NAMES } from "@/lib/contracts";
import { formatQu, formatUsdFromQu, truncateId } from "@/lib/format";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";
import { getVaultAccountIdentity } from "@/lib/accounts";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

function DetailRow({ icon, label, value, valueColor, mono: useMono = true }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
      <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}>{icon}</span>
      <span style={{ ...labelStyle, flex: 1 }}>{label}</span>
      <span style={{
        fontFamily: useMono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "0.8125rem", fontWeight: useMono ? 400 : 500,
        color: valueColor ?? "var(--color-text-display)",
        textAlign: "right", maxWidth: "55%", wordBreak: "break-all",
      }}>{value}</span>
    </div>
  );
}

const CARD_STYLE: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  borderRadius: "var(--radius-card)",
  padding: "4px 16px",
};

const DIVIDER: React.CSSProperties = {
  height: 1, background: "var(--color-border-subtle)", margin: "0 -16px",
};

function resolveProcedureName(contractName: string | undefined, fromContract: string | undefined, inputType: number | null | undefined): string | undefined {
  const scName = contractName ?? fromContract;
  if (!scName) return undefined;
  const contractIndex = Object.entries(CONTRACT_NAMES).find(([, name]) => name === scName)?.[0];
  if (contractIndex == null || inputType == null) return undefined;
  return CONTRACT_PROCEDURE_NAMES[`${contractIndex}:${inputType}`];
}

export default function TxDetailScreen() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const vaults = usePersistedStore((s) => s.vaults);
  const wallets = useSessionStore((s) => s.wallets);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const txMemos = usePersistedStore((s) => s.txMemos);
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);
  const deleteTxMemo = usePersistedStore((s) => s.deleteTxMemo);
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);
  const hideBalances = settings.hideBalances;

  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0] ?? null;
  const identity = getVaultAccountIdentity(vault, settings.activeAccountIndex, wallets);

  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  // Look up the tx: check pending first, then history cache
  const pending = hash ? pendingTxs.find((p) => p.hash === hash) : undefined;
  const historyTx = hash && !pending
    ? (queryClient.getQueriesData<InfiniteData<TxHistoryItem[]>>({ queryKey: ["tx-history"] })
        .flatMap(([, data]) => data?.pages?.flat() ?? [])
        .find((tx) => tx.hash === hash))
    : undefined;

  const detail: TxHistoryItem | PendingTx | undefined = pending ?? historyTx;

  const [memo, setMemo] = useState(hash ? (txMemos[hash] ?? "") : "");
  const [memoEditing, setMemoEditing] = useState(false);

  function saveMemo() {
    if (!hash) return;
    if (memo.trim()) setTxMemo(hash, memo.trim());
    else deleteTxMemo(hash);
    setMemoEditing(false);
  }

  const isPendingTx = (d: TxHistoryItem | PendingTx): d is PendingTx => "broadcastAt" in d;

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", position: "relative", width: "100%", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center", flexShrink: 0 }}>
        <AltArrowLeft size={20} style={{ color: "var(--color-text-primary)" }} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-display)", whiteSpace: "nowrap", pointerEvents: "none" }}>Transaction</span>
    </div>
  );

  if (!detail || !hash) {
    return (
      <AppShell statusBar={statusBar} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-12) 0", gap: "var(--space-3)" }}>
          <ShieldWarning size={32} style={{ color: "var(--color-text-disabled)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-disabled)" }}>
            Transaction not found
          </span>
        </div>
      </AppShell>
    );
  }

  const contractName = detail.destination ? KNOWN_CONTRACT_ADDRESSES[detail.destination] : undefined;
  const fromContract = detail.source ? KNOWN_CONTRACT_ADDRESSES[detail.source] : undefined;
  const isSc = !!(contractName || fromContract);
  const snapshot = findClosestPriceSnapshot(isPendingTx(detail) ? detail.broadcastAt : detail.timestamp, priceSnapshots);

  if (isPendingTx(detail)) {
    const expired = currentTick > 0 && currentTick > detail.targetTick;
    const statusLabel = expired ? "Failed" : "Pending";
    const statusColor = expired ? "var(--color-text-error)" : "var(--color-warning)";
    const amountColor = expired ? "var(--color-text-disabled)" : "var(--color-accent)";
    const displayTo = detail.contractName
      ? detail.contractName
      : truncateId(detail.destination ?? "—");

    return (
      <AppShell statusBar={statusBar} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div initial={{ y: 4 }} animate={{ y: 0 }} transition={{ duration: 0.15, ease: "easeOut" }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Amount + Status */}
          <div style={{ textAlign: "center", padding: "var(--space-6) 0 var(--space-3)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "1.75rem", fontWeight: 500, color: amountColor }}>
              {hideBalances ? "••••••" : `${formatQu(detail.amount ?? "0")} QU`}
            </div>
            {snapshot && !hideBalances && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
                ≈ ${formatUsdFromQu(detail.amount ?? "0", snapshot.priceUsd)}
              </div>
            )}
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, color: statusColor, marginTop: "var(--space-2)" }}>
              {statusLabel}
            </div>
          </div>

          {/* Detail card */}
          <div style={CARD_STYLE}>
            <DetailRow icon={<UserId size={16} />} label="From" value={detail.source ? truncateId(detail.source) : "—"} valueColor="var(--color-text-secondary)" />
            <div style={DIVIDER} />
            <DetailRow icon={<Wallet size={16} />} label="To" value={displayTo} valueColor="var(--color-text-secondary)" />
            <div style={DIVIDER} />
            <DetailRow icon={<ClockCircle size={16} />} label="Target tick" value={String(detail.targetTick)} mono={false} />
            <div style={DIVIDER} />
            <DetailRow icon={<Bolt size={16} />} label="Hash" value={truncateId(hash)} />
          </div>
        </motion.div>
      </AppShell>
    );
  }

  // Confirmed tx
  const isIn = detail.destination === identity;
  const flew = detail.moneyFlew;
  const procedureName = resolveProcedureName(contractName, fromContract, detail.inputType);

  let statusLabel: string;
  let statusColor: string;
  let amountColor: string;

  if (!flew) {
    statusLabel = "Failed";
    statusColor = "var(--color-text-error)";
    amountColor = "var(--color-text-disabled)";
  } else if (isSc) {
    statusLabel = procedureName ?? "SC call";
    statusColor = "var(--color-text-secondary)";
    amountColor = "var(--color-text-display)";
  } else if (isIn) {
    statusLabel = "Received";
    statusColor = "var(--color-accent)";
    amountColor = "var(--color-accent)";
  } else {
    statusLabel = "Sent";
    statusColor = "var(--color-text-secondary)";
    amountColor = "var(--color-text-display)";
  }

  const displayTo = isSc
    ? (contractName ?? fromContract ?? truncateId(detail.destination ?? "—"))
    : truncateId(detail.destination ?? "—");

  return (
    <AppShell statusBar={statusBar} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div initial={{ y: 4 }} animate={{ y: 0 }} transition={{ duration: 0.15, ease: "easeOut" }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {/* Amount + Status */}
        <div style={{ textAlign: "center", padding: "var(--space-6) 0 var(--space-3)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "1.75rem", fontWeight: 500, color: amountColor }}>
            {hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQu(detail.amount ?? "0")} QU`}
          </div>
          {snapshot && !hideBalances && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
              ≈ $${formatUsdFromQu(detail.amount ?? "0", snapshot.priceUsd)}
            </div>
          )}
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, color: statusColor, marginTop: "var(--space-2)" }}>
            {statusLabel}
          </div>
        </div>

        {/* Detail card */}
        <div style={CARD_STYLE}>
          <DetailRow icon={<ArrowRightUp size={16} />} label="From" value={isSc && !isIn ? (fromContract ?? truncateId(detail.source ?? "—")) : truncateId(detail.source ?? "—")} valueColor="var(--color-text-secondary)" />
          <div style={DIVIDER} />
          <DetailRow icon={<Wallet size={16} />} label="To" value={displayTo} valueColor="var(--color-text-secondary)" />
          <div style={DIVIDER} />
          <DetailRow icon={<ShieldCheck size={16} />} label="Tick" value={detail.tickNumber != null ? String(detail.tickNumber) : "—"} mono={false} />
          <div style={DIVIDER} />
          <DetailRow icon={<Bolt size={16} />} label="Hash" value={truncateId(hash)} />
          {snapshot && !hideBalances && (
            <>
              <div style={DIVIDER} />
              <DetailRow icon={<Wallet size={16} />} label="Fiat value" value={`$${formatUsdFromQu(detail.amount ?? "0", snapshot.priceUsd)}`} valueColor="var(--color-text-secondary)" mono={false} />
            </>
          )}
        </div>

        {/* Notes */}
        {memoEditing ? (
          <div style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: "var(--space-3)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
              <NotesMinimalistic size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)", marginTop: 2 }} />
              <textarea
                autoFocus
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a note"
                rows={2}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "var(--color-text-display)", fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem", lineHeight: 1.5, padding: 0, resize: "none",
                  boxSizing: "border-box", minWidth: 0,
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <button type="button" onClick={() => { setMemo(txMemos[hash] ?? ""); setMemoEditing(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-disabled)", padding: "var(--space-1) var(--space-2)" }}>Cancel</button>
              <button type="button" onClick={saveMemo} style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-primary)", padding: "var(--space-1) var(--space-3)" }}>Save</button>
            </div>
          </div>
        ) : (
          <div style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: "14px 16px",
            display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
            cursor: "pointer",
          }} onClick={() => setMemoEditing(true)}>
            <NotesMinimalistic size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)", marginTop: 2 }} />
            {memo.trim() ? (
              <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{memo.trim()}</span>
            ) : (
              <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", lineHeight: 1.5 }}>Add a note</span>
            )}
          </div>
        )}

      </motion.div>
    </AppShell>
  );
}
