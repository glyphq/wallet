import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { Tag } from "@/components/tag";
import { formatDate, formatQu, truncateId } from "@/lib/format";
import type { PendingTx, PriceSnapshot } from "@/store/persisted";
import { DetailRow, SectionLabel } from "./tx-detail-ui";
import { describePendingTx } from "./tx-detail-helpers";

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
  const { kindLabel, statusLabel, statusVariant, amountColor, displayTo, progress } = describePendingTx(tx, currentTick);

  return (
    <motion.div {...presets.fadeIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-4) 0" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {kindLabel}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: 500, color: amountColor, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {hideBalances ? "••••••" : `${formatQu(tx.amount ?? "0")} QU`}
        </span>
        {snapshot && !hideBalances ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
            {fiatValue}
          </span>
        ) : null}
        <Tag variant={statusVariant}>{statusLabel}</Tag>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <SectionLabel>Details</SectionLabel>
        <DetailRow label="From" value={tx.source ? truncateId(tx.source) : "—"} copyValue={tx.source ?? undefined} />
        <DetailRow label="To" value={displayTo} copyValue={tx.destination ?? undefined} />
        <DetailRow label="Broadcast" value={formatDate(tx.broadcastAt) || "—"} mono={false} />
        <DetailRow label="Target tick" value={String(tx.targetTick)} />
        <DetailRow label="Progress" value={progress.timingText} mono={false} />
        <DetailRow label="Hash" value={truncateId(hash)} copyValue={hash} />
      </section>
    </motion.div>
  );
}
