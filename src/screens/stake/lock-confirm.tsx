import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { formatQu } from "@/lib/format";
import { StakeFlowShell } from "./stake-ui";
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
    <StakeFlowShell footer={<ConfirmActions disabled={disabled} onSend={onSend} onCancel={onCancel} />}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <ConfirmAmountHeader amount={formatQu(amountStr)} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <StatRow label="Contract" value="Qearn" />
          <StatRow label="Action" value="Lock QU" />
          <StatRow label="Lock epoch" value={currentEpoch ?? "—"} />
          <StatRow label="Unlocks at epoch" value={(currentEpoch ?? 0) + LOCK_PERIOD_EPOCHS} />
          <StatRow label="Lock period" value={`${LOCK_PERIOD_EPOCHS} epochs`} />
        </div>
      </motion.div>
    </StakeFlowShell>
  );
}
