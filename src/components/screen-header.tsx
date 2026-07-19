import type { ReactNode } from "react";
import { AltArrowLeft } from "@solar-icons/react";
import { IconButton } from "@/components/icon-button";

export interface ScreenHeaderProps {
  title: ReactNode;
  onBack?: () => void;
  backAriaLabel?: string;
  action?: ReactNode;
  leading?: ReactNode;
  eyebrow?: string;
}

export function ScreenHeader({ title, onBack, backAriaLabel, action, leading, eyebrow }: ScreenHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%", minHeight: 52 }}>
      {onBack ? (
        <IconButton label={backAriaLabel ?? "Go back"} onClick={onBack} style={{ flexShrink: 0 }}>
          <AltArrowLeft size={22} aria-hidden="true" />
        </IconButton>
      ) : null}
      {leading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{leading}</div> : null}
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: eyebrow ? 1 : 0 }}>
        {eyebrow ? (
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-caption)",
              lineHeight: "var(--leading-compact)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-section)",
            lineHeight: "var(--leading-tight)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
      </div>
      {action ? (
        <div style={{ marginLeft: "auto", minHeight: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-1)" }}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
