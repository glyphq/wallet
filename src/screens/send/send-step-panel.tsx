import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";

export interface SendStepPanelProps {
  children: ReactNode;
  /** Optional status bar rendered above the content (input steps only). */
  statusBar?: ReactNode;
  /** "auto" scrolls both axes, "y" only vertically; omitted locks scrolling. */
  scroll?: "auto" | "y";
  gap?: string;
  /** Center the column vertically. */
  centered?: boolean;
  /** Center the column horizontally. */
  alignCenter?: boolean;
  /** Input steps use "min-content"; every other step uses 0. */
  minHeight?: "0" | "min-content";
  role?: "status" | "alert";
  ariaLive?: "polite";
  ariaBusy?: boolean;
}

/** Full-bleed send-flow step shell: AppShell + animated column. */
export function SendStepPanel({
  children,
  statusBar,
  scroll,
  gap,
  centered = false,
  alignCenter = false,
  minHeight = "0",
  role,
  ariaLive,
  ariaBusy,
}: SendStepPanelProps) {
  const contentStyle: CSSProperties = { padding: "var(--space-4)", height: "100%" };
  if (scroll === "auto") contentStyle.overflow = "auto";
  else if (scroll === "y") contentStyle.overflowY = "auto";

  const bodyStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight,
  };
  if (centered) bodyStyle.justifyContent = "center";
  if (alignCenter) bodyStyle.alignItems = "center";
  if (gap) bodyStyle.gap = gap;

  return (
    <AppShell fullBleed statusBar={statusBar} contentStyle={contentStyle}>
      <motion.div {...stepMotion} role={role} aria-live={ariaLive} aria-busy={ariaBusy} style={bodyStyle}>
        {children}
      </motion.div>
    </AppShell>
  );
}
