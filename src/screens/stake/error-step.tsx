import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { ShieldAlertIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { StakeFlowShell } from "./stake-ui";

interface ErrorStepProps {
  txError: string;
  onRetry: () => void;
  onCancel: () => void;
}

/** Error step: broadcast failure with retry and cancel actions. */
export function ErrorStep({ txError, onRetry, onCancel }: ErrorStepProps) {
  return (
    <StakeFlowShell footer={(
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Button type="button" onClick={onRetry}>Try again</Button>
        <Button type="button" variant="ghost" size="md" style={{ width: "100%" }} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    )}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", minHeight: "60vh", alignItems: "center", justifyContent: "center", gap: "var(--space-3)" }}>
        <ShieldAlertIcon size={28} strokeWidth={1.5} color="var(--color-status-error)" aria-hidden="true" />
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            Transaction failed
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)", maxWidth: 280, lineHeight: "var(--leading-body)" }}>
            {txError || "The transaction could not be broadcast."}
          </span>
        </div>
      </motion.div>
    </StakeFlowShell>
  );
}
