import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { BrandLockup } from "@/components/brand-lockup";
import { presets } from "@/lib/animations";

export interface PageBannerProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

/** Top-of-page ASCII banner, sized to 25% of the viewport height. */
export function PageBanner({ eyebrow, title, description }: PageBannerProps) {
  return (
    <header className="page-banner">
      <AsciiBackdrop
        style={{ height: "100%" }}
        contentStyle={{
          zIndex: 2,
          height: "100%",
          padding: "var(--space-5) var(--screen-padding) var(--space-4)",
          justifyContent: "flex-end",
        }}
      >
        <motion.div {...presets.slideUp} className="page-banner-copy">
          <BrandLockup size={34} iconOnly align="center" />
          {eyebrow ? <span className="page-banner-eyebrow">{eyebrow}</span> : null}
          <h1 className="page-banner-title">{title}</h1>
          {description ? <p className="page-banner-description">{description}</p> : null}
        </motion.div>
      </AsciiBackdrop>
    </header>
  );
}

/** Full-width bordered content surface with pinned bottom actions. */
export function PageFrame({
  children,
  actions,
  centered = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div className="page-frame">
      <div className="page-frame-content" style={centered ? { justifyContent: "center" } : undefined}>
        {children}
      </div>
      {actions ? (
        <div className="page-frame-actions">
          <div className="page-frame-actions-inner">{actions}</div>
        </div>
      ) : null}
    </div>
  );
}
