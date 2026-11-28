import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatQu } from "@/lib/format";
import { explorerAccountUrl, explorerEpochUrl, explorerTickUrl, explorerTransactionUrl, openExplorer } from "@/lib/explorer";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PriceSnapshot } from "@/store/persisted";
import {
  ContractValue,
  IdentityValue,
  StatChip,
  TxBox,
  TxSection,
} from "./tx-detail-ui";
import { CopyButton } from "@/components/copy-button";
import { describeConfirmedTx, formatTransactionTimestamp } from "./tx-detail-helpers";
import { TxDetailMemo } from "./tx-detail-memo";

export function ConfirmedTxDetail({
  tx, hash, hideBalances, snapshot, fiatValue, memo, onSaveMemo,
}: {
  tx: TxHistoryItem;
  hash: string;
  hideBalances: boolean;
  snapshot: PriceSnapshot | null;
  fiatValue: string;
  memo: string;
  onSaveMemo: (next: string) => void;
}) {
  const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
  const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
  const { kindLabel, amountColor } = describeConfirmedTx(tx, contractName, fromContract);
  const succeeded = tx.moneyFlew;

  return (
    <motion.div {...presets.fadeIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-display)", fontWeight: 500, color: "var(--color-text-primary)", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          {kindLabel}
        </h1>
        <button
          type="button"
          aria-label="Open transaction in Glyph Explorer"
          onClick={() => openExplorer(explorerTransactionUrl(hash))}
          style={{ alignSelf: "flex-start", maxWidth: "100%", background: "none", border: 0, padding: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.02em", textAlign: "left", overflowWrap: "anywhere", cursor: "pointer" }}
        >
          {hash}
        </button>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
          {formatTransactionTimestamp(tx.timestamp)}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", paddingTop: "var(--space-1)" }}>
          <StatChip tone={succeeded ? "success" : "error"}>{succeeded ? "Success" : "Failed"}</StatChip>
          <StatChip ariaLabel="Open tick in Glyph Explorer" onClick={() => openExplorer(explorerTickUrl(tx.tickNumber))}>
            {formatQu(tx.tickNumber)}
          </StatChip>
          {tx.epoch != null ? (
            <StatChip ariaLabel="Open epoch in Glyph Explorer" onClick={() => openExplorer(explorerEpochUrl(tx.epoch!))}>
              {tx.epoch}
            </StatChip>
          ) : null}
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
        <TxBox
          ariaLabel="Open sender in Glyph Explorer"
          onClick={tx.source ? () => openExplorer(explorerAccountUrl(tx.source!)) : undefined}
          action={tx.source ? <CopyButton value={tx.source} label="sender address" /> : undefined}
        >
          {fromContract && tx.source ? (
            <ContractValue name={fromContract} />
          ) : (
            <IdentityValue identity={tx.source ?? "—"} />
          )}
        </TxBox>
      </TxSection>

      <TxSection label="To">
        <TxBox
          ariaLabel="Open recipient in Glyph Explorer"
          onClick={tx.destination ? () => openExplorer(explorerAccountUrl(tx.destination!)) : undefined}
          action={tx.destination ? <CopyButton value={tx.destination} label="recipient address" /> : undefined}
        >
          {contractName && tx.destination ? (
            <ContractValue name={contractName} />
          ) : (
            <IdentityValue identity={tx.destination ?? "—"} />
          )}
        </TxBox>
      </TxSection>

      <TxDetailMemo memo={memo} onSave={onSaveMemo} />
    </motion.div>
  );
}
