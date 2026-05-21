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
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0, flexShrink: 0 }}
      >
        ← BACK
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", pointerEvents: "none" }}>
        {title}
      </span>
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        {action}
      </div>
    </div>
  );
}
