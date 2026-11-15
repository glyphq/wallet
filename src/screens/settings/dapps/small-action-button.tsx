import type { ReactNode } from "react";

/** Small destructive text button used for per-dApp removal actions. */
export function SmallActionButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: ReactNode;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: 600,
        color: "var(--color-status-error)",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
