import { motion } from "motion/react";
import { AsciiSpinner } from "@/components/ascii-spinner";
import { presets } from "@/lib/animations";

export function UnlockingPanel() {
  return (
    <motion.div
      {...presets.fadeIn}
      role="status"
      style={{
        width: "100%",
        maxWidth: 320,
        margin: "0 auto",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        textAlign: "center",
      }}
    >
      <AsciiSpinner size={104} />
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body)",
          color: "var(--color-text-secondary)",
        }}
      >
        Unlocking local session.
      </p>
    </motion.div>
  );
}
