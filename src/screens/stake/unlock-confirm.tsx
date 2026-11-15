import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { ShieldAlertIcon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { RowDivider, sectionStyle } from "./stake-ui";
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
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        <ConfirmAmountHeader amount={formatQu(position.lockedAmount)} />

        {/* Details */}
        <div style={sectionStyle}>
          <StatRow label="Contract" tone="display" value="Qearn" />
          <RowDivider />
          <StatRow label="Action" tone="display" value="Unlock QU" />
          <RowDivider />
          <StatRow label="Locked epoch" tone="display" value={position.epoch} />
          <RowDivider />
          <StatRow
            label="Maturity"
            tone="display"
            valueStyle={{ color: isEarly ? "var(--color-status-warning)" : "var(--color-accent)" }}
            value={isEarly ? `${epochsLeft} epochs early` : "Mature"}
          />
        </div>

        {isEarly && (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-status-warning)", flexShrink: 0, marginTop: 1 }}><ShieldAlertIcon size={16} /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-warning)", lineHeight: 1.5 }}>
              Early unlock — rewards may be reduced or forfeited. The position matures at epoch {unlockEpoch}.
            </span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <ConfirmActions disabled={disabled} onSend={onSend} onCancel={onCancel} />

      </motion.div>
    </AppShell>
  );
}
