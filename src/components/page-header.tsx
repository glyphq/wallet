import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { presets } from "@/lib/animations";

/** Full-width page header with the ASCII field confined to the header band. */
export function PageHeader({ children }: { children: ReactNode }) {
  return (
    <header className="page-header">
      <AsciiBackdrop
        contentStyle={{
          zIndex: 2,
          padding: "clamp(28px, 6vw, 56px) var(--screen-padding)",
          justifyContent: "flex-end",
          gap: "var(--space-5)",
        }}
      >
        <motion.div
          {...presets.slideUp}
          style={{
            width: "100%",
            maxWidth: 420,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          {children}
        </motion.div>
      </AsciiBackdrop>
    </header>
  );
}
