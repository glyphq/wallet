import type { ReactNode } from "react";

export function SheetDragHandle() {
  return (
    <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
      <div style={{ width: 32, height: 2, background: "var(--color-border-contrast)", borderRadius: 999 }} />
    </div>
  );
}

export interface SheetHeaderProps {
  titleId: string;
  title: string;
  onClose: () => void;
}

export function SheetHeader({ titleId, title, onClose }: SheetHeaderProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
      <h2 id={titleId} style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-section)", fontWeight: 600,
        color: "var(--color-text-primary)", letterSpacing: "-0.02em", margin: 0,
      }}>
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${title}`}
        style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-disabled)", padding: 0, lineHeight: 1, fontSize: 14 }}
      >
        ✕
      </button>
    </div>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return (
    <div style={{ overflowY: "auto", flex: 1, padding: "0 0 var(--space-4)" }}>
      {children}
    </div>
  );
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{
      flexShrink: 0,
      borderTop: "1px solid var(--color-border-subtle)",
      paddingTop: "var(--space-4)",
      paddingBottom: "var(--space-8)",
    }}>
      {children}
    </div>
  );
}
