import type { ReactNode } from "react";
import { AltArrowLeft } from "@solar-icons/react";

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  backAriaLabel?: string;
  action?: ReactNode;
}

export function ScreenHeader({ title, onBack, backAriaLabel, action }: ScreenHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative", width: "100%", minHeight: 44 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label={backAriaLabel ?? "Go back"}
        style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-primary)", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        <AltArrowLeft size={20} aria-hidden="true" />
      </button>
      <h1 style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", letterSpacing: "-0.01em", whiteSpace: "nowrap", pointerEvents: "none", margin: 0, maxWidth: "calc(100% - 112px)", overflow: "hidden", textOverflow: "ellipsis" }}>
        {title}
      </h1>
      <div style={{ marginLeft: "auto", minWidth: 44, minHeight: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        {action}
      </div>
    </div>
  );
}
