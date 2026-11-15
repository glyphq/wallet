import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { formatQu } from "@/lib/format";
import { RowDivider, sectionStyle } from "./stake-ui";
import { StatRow } from "./stat-row";
import { ConfirmActions, ConfirmAmountHeader } from "./confirm-parts";
import { LOCK_PERIOD_EPOCHS } from "./stake-model";

interface LockConfirmProps {
  amountStr: string;
  currentEpoch: number | null;
  disabled: boolean;
  onSend: () => void;
  onCancel: () => void;
}

/** Confirm step for locking QU into Qearn. */
export function LockConfirm({ amountStr, currentEpoch, disabled, onSend, onCancel }: LockConfirmProps) {
  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        <ConfirmAmountHeader amount={formatQu(amountStr)} />

        {/* Details */}
        <div style={sectionStyle}>
          <StatRow label="Contract" tone="display" value="Qearn" />
          <RowDivider />
          <StatRow label="Action" tone="display" value="Lock QU" />
          <RowDivider />
          <StatRow label="Lock epoch" tone="display" value={currentEpoch} />
          <RowDivider />
          <StatRow label="Unlocks at epoch" tone="display" value={(currentEpoch ?? 0) + LOCK_PERIOD_EPOCHS} />
          <RowDivider />
          <StatRow label="Lock period" tone="display" value={`${LOCK_PERIOD_EPOCHS} epochs`} />
        </div>

        <div style={{ flex: 1 }} />

        <ConfirmActions disabled={disabled} onSend={onSend} onCancel={onCancel} />

      </motion.div>
    </AppShell>
  );
}
