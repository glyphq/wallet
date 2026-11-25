import type { CSSProperties, ReactNode } from "react";
import { labelStyle, valueStyle } from "./stake-ui";

type StatTone = "value" | "primary" | "display" | "accent";

const TONE: Record<StatTone, CSSProperties> = {
  value: valueStyle,
  primary: {
    ...valueStyle,
    color: "var(--color-text-primary)",
  },
  display: {
    ...valueStyle,
    color: "var(--color-text-display)",
  },
  accent: {
    ...valueStyle,
    fontWeight: 500,
    color: "var(--color-accent)",
  },
};

interface StatRowProps {
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
  valueStyle?: CSSProperties;
}

/** Label/value line used across the stake panels. */
export function StatRow({ label, value, tone = "value", valueStyle: override }: StatRowProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ ...TONE[tone], ...override }}>{value}</span>
    </div>
  );
}
