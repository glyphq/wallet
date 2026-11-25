import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatDate, formatQu, truncateId } from "@/lib/format";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PriceSnapshot } from "@/store/persisted";
import { DetailRow, SectionLabel } from "./tx-detail-ui";
import { describeConfirmedTx } from "./tx-detail-helpers";
import { TxDetailMemo } from "./tx-detail-memo";

export function ConfirmedTxDetail({
  tx, hash, identity, hideBalances, snapshot, fiatValue, memo, onSaveMemo,
}: {
  tx: TxHistoryItem;
  hash: string;
  identity: string | null;
  hideBalances: boolean;
  snapshot: PriceSnapshot | null;
  fiatValue: string;
  memo: string;
  onSaveMemo: (next: string) => void;
}) {
  const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
  const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
  const { isIn, isSc, kindLabel, amountColor, displayTo } = describeConfirmedTx(tx, identity, contractName, fromContract);

  return (
    <motion.div {...presets.fadeIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-4) 0" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {kindLabel}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: 500, color: amountColor, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQu(tx.amount ?? "0")} QU`}
        </span>
        {snapshot && !hideBalances ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
            {fiatValue}
          </span>
        ) : null}
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <SectionLabel>Details</SectionLabel>
        <DetailRow
          label="From"
          value={isSc && !isIn ? (fromContract ?? truncateId(tx.source ?? "—")) : truncateId(tx.source ?? "—")}
          copyValue={tx.source ?? undefined}
        />
        <DetailRow label="To" value={displayTo} copyValue={tx.destination ?? undefined} />
        <DetailRow label="Time" value={formatDate(tx.timestamp) || "—"} mono={false} />
        <DetailRow label="Tick" value={tx.tickNumber != null ? String(tx.tickNumber) : "—"} />
        <DetailRow label="Hash" value={truncateId(hash)} copyValue={hash} />
      </section>

      <TxDetailMemo memo={memo} onSave={onSaveMemo} />
    </motion.div>
  );
}
