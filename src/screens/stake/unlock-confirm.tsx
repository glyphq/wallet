import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { ShieldAlertIcon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { StakeFlowShell } from "./stake-ui";
import { StatRow } from "./stat-row";
import { ConfirmActions, ConfirmAmountHeader } from "./confirm-parts";
import { LOCK_PERIOD_EPOCHS, type Position } from "./stake-model";

interface UnlockConfirmProps {
  position: Position;
  currentEpoch: number | null;
  disabled: boolean;
  onSend: () => void;
  onCancel: () => void;
}

/** Confirm step for unlocking a Qearn position, including early-unlock warning. */
export function UnlockConfirm({ position, currentEpoch, disabled, onSend, onCancel }: UnlockConfirmProps) {
  const unlockEpoch = position.epoch + LOCK_PERIOD_EPOCHS;
  const isEarly = currentEpoch !== null && currentEpoch < unlockEpoch;
  const epochsLeft = isEarly ? unlockEpoch - (currentEpoch ?? 0) : 0;

  return (
    <StakeFlowShell footer={<ConfirmActions disabled={disabled} onSend={onSend} onCancel={onCancel} />}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <ConfirmAmountHeader amount={formatQu(position.lockedAmount)} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <StatRow label="Contract" value="Qearn" />
          <StatRow label="Action" value="Unlock QU" />
          <StatRow label="Locked epoch" value={position.epoch} />
          <StatRow
            label="Maturity"
            valueStyle={{ color: isEarly ? "var(--color-status-warning)" : "var(--color-accent)" }}
            value={isEarly ? `${epochsLeft} epochs early` : "Mature"}
          />
        </div>

        {isEarly ? (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-status-warning)", flexShrink: 0, marginTop: 1 }}>
              <ShieldAlertIcon size={16} aria-hidden="true" />
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-warning)", lineHeight: "var(--leading-body)" }}>
              Early unlock — rewards may be reduced or forfeited. The position matures at epoch {unlockEpoch}.
            </span>
          </div>
        ) : null}
      </motion.div>
    </StakeFlowShell>
  );
}
