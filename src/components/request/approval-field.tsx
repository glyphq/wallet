import type { ReactNode } from "react";
import { ArrowDown01Icon } from "@/lib/icons";

/** Labeled request value using the shared approval typography. */
export function ApprovalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

/** Collapsible labeled approval section using the shared label/value rhythm. */
export function ApprovalDisclosure({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="approval-disclosure" open={defaultOpen}>
      <summary>
        <span>{label}</span>
        <span className="approval-disclosure-chevron" aria-hidden="true"><ArrowDown01Icon size={14} /></span>
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        {children}
      </div>
    </details>
  );
}
