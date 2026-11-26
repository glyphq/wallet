import type { ReactNode } from "react";
import { SettingsSectionLabel } from "@/components/settings-section-elements";

export function DiagnosticSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <SettingsSectionLabel>{title}</SettingsSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>{children}</div>
    </section>
  );
}

export function DiagnosticRow({ label, value, tone, technical = false }: { label: string; value: string; tone?: "success" | "warning" | "error"; technical?: boolean }) {
  const color = tone === "success" ? "var(--color-status-success)" : tone === "warning" ? "var(--color-status-warning)" : tone === "error" ? "var(--color-status-error)" : "var(--color-text-primary)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", gap: "var(--space-4)", alignItems: "baseline", padding: "var(--space-2) 0" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ minWidth: 0, color, textAlign: "right", overflowWrap: "anywhere", fontFamily: technical ? "var(--font-mono)" : "var(--font-mono)", fontSize: technical ? "var(--text-caption)" : "var(--text-mono-sm)", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
