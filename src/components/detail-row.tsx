import type { ReactNode } from "react";

export interface DetailRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}

export function DetailRow({ icon, label, value, valueColor, mono = true }: DetailRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
      <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}>{icon}</span>
      <span style={{
        flex: 1,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: mono ? 400 : 500,
        color: valueColor ?? "var(--color-text-display)",
        textAlign: "right",
        maxWidth: "55%",
        wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}
