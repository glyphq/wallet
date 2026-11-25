import type { CSSProperties, ReactNode } from "react";

export const labelStyle: CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

/** Accent spinner used while broadcasting and while watching a transaction. */
export function StatusSpinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid var(--color-border-subtle)",
        borderTopColor: "var(--color-accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/** Sticky footer for send-flow actions. */
export function SendStepFooter({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 5,
        marginInline: "calc(var(--space-4) * -1)",
        padding: "var(--space-3) var(--space-4)",
        borderTop: "1px solid var(--color-border-subtle)",
        background: "var(--color-bg-base)",
      }}
    >
      {children}
    </div>
  );
}
