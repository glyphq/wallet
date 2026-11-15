import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { ArrowUpRight01Icon, Wallet01Icon, ShieldCheckIcon, FlashIcon } from "@/lib/icons";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatQu, truncateId } from "@/lib/format";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PriceSnapshot } from "@/store/persisted";
import { CARD_STYLE, DIVIDER, DetailRow } from "./tx-detail-ui";
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
  const { isIn, isSc, statusLabel, statusColor, amountColor, displayTo } = describeConfirmedTx(tx, identity, contractName, fromContract);

  return (
    <motion.div {...presets.fadeIn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* Amount + Status */}
      <div style={{ textAlign: "center", padding: "var(--space-6) 0 var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: amountColor }}>
          {hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQu(tx.amount ?? "0")} QU`}
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
        <DetailRow icon={<ArrowUpRight01Icon size={16} />} label="From" value={isSc && !isIn ? (fromContract ?? truncateId(tx.source ?? "—")) : truncateId(tx.source ?? "—")} valueColor="var(--color-text-secondary)" copyValue={tx.source ?? undefined} />
        <div style={DIVIDER} />
        <DetailRow icon={<Wallet01Icon size={16} />} label="To" value={displayTo} valueColor="var(--color-text-secondary)" copyValue={tx.destination ?? undefined} />
        <div style={DIVIDER} />
        <DetailRow icon={<ShieldCheckIcon size={16} />} label="Tick" value={tx.tickNumber != null ? String(tx.tickNumber) : "—"} mono={false} />
        <div style={DIVIDER} />
        <DetailRow icon={<FlashIcon size={16} />} label="Hash" value={truncateId(hash)} copyValue={hash} />
        {snapshot && !hideBalances && (
          <>
            <div style={DIVIDER} />
            <DetailRow icon={<Wallet01Icon size={16} />} label="Fiat value" value={fiatValue} valueColor="var(--color-text-secondary)" mono={false} />
          </>
        )}
      </div>

      {/* Notes */}
      <TxDetailMemo memo={memo} onSave={onSaveMemo} />
    </motion.div>
  );
}
