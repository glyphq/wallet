import type { ReactNode } from "react";
import { motion } from "motion/react";
import { gesture } from "@/lib/animations";

export function DiagnosticSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
      <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "var(--space-1) 0 var(--space-3)", color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.45 }}>{description}</p>
      <div>{children}</div>
    </section>
  );
}

export function DiagnosticRow({ label, value, tone, technical = false }: { label: string; value: string; tone?: "success" | "warning" | "error"; technical?: boolean }) {
  const color = tone === "success" ? "var(--color-status-success)" : tone === "warning" ? "var(--color-status-warning)" : tone === "error" ? "var(--color-status-error)" : "var(--color-text-primary)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 0.8fr) minmax(0, 1.7fr)", gap: "var(--space-4)", alignItems: "baseline", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>{label}</span>
      <span style={{ minWidth: 0, color, textAlign: "right", overflowWrap: "anywhere", fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)", fontSize: technical ? "var(--text-caption)" : "var(--text-label)", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

export function ActionRow({ label, detail, onClick, primary = false }: { label: string; detail?: string; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      type="button"
      onClick={onClick}
      style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center", padding: "var(--space-3) 0", border: "none", borderBottom: "1px solid var(--color-border-subtle)", background: "transparent", cursor: "pointer", textAlign: "left" }}
    >
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: "block", color: primary ? "var(--color-accent)" : "var(--color-text-primary)", fontSize: "var(--text-label)", fontWeight: 600 }}>{label}</strong>
        {detail && <span style={{ display: "block", marginTop: 2, color: "var(--color-text-secondary)", fontSize: "var(--text-caption)", lineHeight: 1.4 }}>{detail}</span>}
      </span>
      <span aria-hidden="true" style={{ color: primary ? "var(--color-accent)" : "var(--color-text-secondary)", fontSize: "var(--text-body)" }}>›</span>
    </motion.button>
  );
}
