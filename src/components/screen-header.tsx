import type { ReactNode } from "react";
import { AltArrowLeft } from "@solar-icons/react";
import { IconButton } from "@/components/icon-button";

export interface ScreenHeaderProps {
  title: ReactNode;
  onBack?: () => void;
  backAriaLabel?: string;
  action?: ReactNode;
}

export function ScreenHeader({ title, onBack, backAriaLabel, action }: ScreenHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%", minHeight: 52 }}>
      {onBack ? (
        <IconButton label={backAriaLabel ?? "Go back"} onClick={onBack} style={{ flexShrink: 0 }}>
          <AltArrowLeft size={22} aria-hidden="true" />
        </IconButton>
      ) : null}
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
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
