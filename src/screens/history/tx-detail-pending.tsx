import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { formatQu } from "@/lib/format";
import type { PendingTx, PriceSnapshot } from "@/store/persisted";
import {
  ContractValue,
  CopyButton,
  IdentityValue,
  StatChip,
  TxBox,
  TxSection,
} from "./tx-detail-ui";
import { describePendingTx, formatTransactionTimestamp } from "./tx-detail-helpers";

export function PendingTxDetail({
  tx, hash, currentTick, hideBalances, snapshot, fiatValue,
}: {
  tx: PendingTx;
  hash: string;
  currentTick: number;
  hideBalances: boolean;
  snapshot: PriceSnapshot | null;
  fiatValue: string;
}) {
  const { kindLabel, amountColor } = describePendingTx(tx);
  const progress = pendingTxProgress(tx.targetTick, currentTick);
  const expired = progress.phase === "expired";
  const contractLabel = tx.contractName?.split("·")[0]?.trim() || null;

  return (
    <motion.div {...presets.fadeIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-display)", fontWeight: 500, color: "var(--color-text-primary)", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          {kindLabel}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.02em", overflowWrap: "anywhere" }}>
            {tx.source ?? "—"}
          </span>
          {tx.source ? <CopyButton value={tx.source} label="identity" /> : null}
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
          {formatTransactionTimestamp(tx.broadcastAt)}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", paddingTop: "var(--space-1)" }}>
          <StatChip tone={expired ? "error" : "warning"}>{progress.label}</StatChip>
          <StatChip>{formatQu(tx.targetTick)}</StatChip>
        </div>
      </header>

      <TxSection label="Amount">
        <TxBox style={{ minHeight: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: 500, color: amountColor, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {hideBalances ? "••••••" : `${formatQu(tx.amount ?? "0")} QUBIC`}
            </span>
            {snapshot && !hideBalances ? (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
                {fiatValue}
              </span>
            ) : null}
          </div>
        </TxBox>
      </TxSection>

      <TxSection label="From">
        <TxBox>
          <IdentityValue identity={tx.source ?? "—"} />
        </TxBox>
      </TxSection>

      <TxSection label="To">
        <TxBox>
          {contractLabel && tx.destination ? (
            <ContractValue name={contractLabel} address={tx.destination} />
          ) : (
            <IdentityValue identity={tx.destination ?? "—"} />
          )}
        </TxBox>
      </TxSection>

      <TxSection label="Hash">
        <TxBox>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
            {hash}
          </span>
          <CopyButton value={hash} label="transaction hash" />
        </TxBox>
      </TxSection>
    </motion.div>
  );
}
