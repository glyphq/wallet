import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { CheckmarkCircle01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { StakeFlowShell, type StakeTab } from "./stake-ui";

interface DoneStepProps {
  tab: StakeTab;
  txHash: string;
  onDone: () => void;
  onBack: () => void;
}

/** Done step: success state and transaction hash. */
export function DoneStep({ tab, txHash, onDone, onBack }: DoneStepProps) {
  return (
    <StakeFlowShell footer={(
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Button type="button" onClick={onDone}>Done</Button>
        <Button type="button" variant="ghost" size="md" style={{ width: "100%" }} onClick={onBack}>
          Back to staking
        </Button>
      </div>
    )}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-4) 0" }}>
          <CheckmarkCircle01Icon size={28} strokeWidth={1.5} color="var(--color-accent)" aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-accent)" }}>
            {tab === "lock" ? "Locked" : "Unlocked"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
            Transaction hash
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-primary)", wordBreak: "break-all" }}>
            {txHash}
          </span>
        </div>
      </motion.div>
    </StakeFlowShell>
  );
}
