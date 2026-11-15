import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { BrandLockup } from "@/components/brand-lockup";

export function UnlockingPanel() {
  return (
    <motion.div
      {...presets.fadeIn}
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
      <BrandLockup align="center" compact iconOnly />
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "2px solid var(--color-border-default)",
          borderTopColor: "var(--color-accent)",
          animation: "spin 0.8s linear infinite",
        }}
      />
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
