import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { UserCircleIcon, Wallet01Icon, Clock01Icon, FlashIcon } from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import type { PendingTx, PriceSnapshot } from "@/store/persisted";
import { CARD_STYLE, DIVIDER, DetailRow } from "./tx-detail-ui";
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
  const { statusLabel, statusColor, amountColor, displayTo, progress } = describePendingTx(tx, currentTick);

  return (
    <motion.div {...presets.fadeIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* Amount + Status */}
      <div style={{ textAlign: "center", padding: "var(--space-6) 0 var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: amountColor }}>
          {hideBalances ? "••••••" : `${formatQu(tx.amount ?? "0")} QU`}
        </div>
        {snapshot && !hideBalances && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
            {fiatValue}
          </div>
        )}
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: statusColor, marginTop: "var(--space-2)" }}>
          {statusLabel}
        </div>
      </div>

      {/* Detail card */}
      <div style={CARD_STYLE}>
        <DetailRow icon={<UserCircleIcon size={16} />} label="From" value={tx.source ? truncateId(tx.source) : "—"} valueColor="var(--color-text-secondary)" copyValue={tx.source ?? undefined} />
        <div style={DIVIDER} />
        <DetailRow icon={<Wallet01Icon size={16} />} label="To" value={displayTo} valueColor="var(--color-text-secondary)" copyValue={tx.destination ?? undefined} />
        <div style={DIVIDER} />
        <DetailRow icon={<Clock01Icon size={16} />} label="Target tick" value={String(tx.targetTick)} mono={false} />
        <div style={DIVIDER} />
        <DetailRow icon={<Clock01Icon size={16} />} label="Progress" value={progress.timingText} valueColor="var(--color-text-secondary)" />
        <div style={DIVIDER} />
        <DetailRow icon={<FlashIcon size={16} />} label="Hash" value={truncateId(hash)} copyValue={hash} />
      </div>
    </motion.div>
  );
}
