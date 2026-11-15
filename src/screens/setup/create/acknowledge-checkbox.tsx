import type { ReactNode } from "react";
import { CheckmarkCircle01Icon } from "@/lib/icons";

/** Square acknowledgement control used before a seed backup can continue. */
export function AcknowledgeCheckbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        minHeight: 48,
        padding: "0 var(--space-1)",
        border: 0,
        background: "transparent",
        fontFamily: "var(--font-sans)",
        fontSize: "0.875rem",
        color: "var(--color-text-primary)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
          border: `1px solid ${checked ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
          borderRadius: 7,
          background: checked ? "var(--color-text-primary)" : "var(--color-bg-surface-2)",
          color: "var(--color-text-inverse)",
          transition: "background-color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
        }}
      >
        {checked ? <CheckmarkCircle01Icon size={16} strokeWidth={2} /> : null}
      </span>
      {children}
    </button>
  );
}
