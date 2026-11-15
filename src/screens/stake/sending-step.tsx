import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SquareLock01Icon, SquareUnlock01Icon } from "@/lib/icons";
import type { StakeTab } from "./stake-ui";

interface SendingStepProps {
  tab: StakeTab;
  amount: string;
}

/** Sending step: spinner while the transaction broadcasts. */
export function SendingStep({ tab, amount }: SendingStepProps) {
  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-5)" }}>
        <div style={{ width: 48, height: 48, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ position: "absolute", inset: 0, border: "3px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <span style={{ position: "relative", zIndex: 1, color: "var(--color-accent)" }}>
            {tab === "lock" ? <SquareLock01Icon size={20} strokeWidth={1.5} /> : <SquareUnlock01Icon size={20} strokeWidth={1.5} />}
          </span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            {tab === "lock" ? "Locking" : "Unlocking"}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
            {amount} QU
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
