import type { ReactNode } from "react";

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  backAriaLabel?: string;
  action?: ReactNode;
}

export function ScreenHeader({ title, onBack, backAriaLabel, action }: ScreenHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={onBack}
        aria-label={backAriaLabel}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.06em", padding: 0, flexShrink: 0 }}
      >
        ← back
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontWeight: 400, color: "var(--color-text-primary)", letterSpacing: "0.08em", whiteSpace: "nowrap", pointerEvents: "none" }}>
        {title}
      </span>
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        {action}
      </div>
    </div>
  );
}
