import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { MoneyBag01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { TextButton } from "@/components/text-button";
import { sectionStyle, type StakeTab } from "./stake-ui";

interface DoneStepProps {
  tab: StakeTab;
  txHash: string;
  onDone: () => void;
  onBack: () => void;
}

/** Done step: success state and transaction hash. */
export function DoneStep({ tab, txHash, onDone, onBack }: DoneStepProps) {
  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        {/* Status */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "var(--space-4)", gap: "var(--space-2)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MoneyBag01Icon size={22} style={{ color: "var(--color-accent)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-accent)" }}>
            {tab === "lock" ? "Locked" : "Unlocked"}
          </span>
        </div>

        {/* Transaction hash */}
        <div style={sectionStyle}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
            Transaction hash
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-primary)", wordBreak: "break-all" }}>
            {txHash}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
          <TextButton type="button" tone="muted" onClick={onBack} style={{ alignSelf: "center", padding: "var(--space-2) 0" }}>
            Back to staking
          </TextButton>
        </div>

      </motion.div>
    </AppShell>
  );
}
