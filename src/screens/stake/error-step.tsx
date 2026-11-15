import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { ShieldAlertIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { TextButton } from "@/components/text-button";

interface ErrorStepProps {
  txError: string;
  onRetry: () => void;
  onCancel: () => void;
}

/** Error step: broadcast failure with retry and cancel actions. */
export function ErrorStep({ txError, onRetry, onCancel }: ErrorStepProps) {
  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-status-error-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldAlertIcon size={22} style={{ color: "var(--color-status-error)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            Transaction failed
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)", maxWidth: 280 }}>
            {txError || "The transaction could not be broadcast."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 280, paddingTop: "var(--space-2)" }}>
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
          <TextButton type="button" tone="muted" onClick={onCancel} style={{ alignSelf: "center", padding: "var(--space-2) 0" }}>
            Cancel
          </TextButton>
        </div>
      </motion.div>
    </AppShell>
  );
}
