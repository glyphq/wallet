import type { CSSProperties, ReactNode } from "react";

export function RequestSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-disabled)",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </div>
  );
}

export function RequestDetailRow({
  label,
  value,
  valueColor,
  badge,
  valueStyle,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  badge?: ReactNode;
  valueStyle?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label)",
          fontWeight: 500,
          color: "var(--color-text-disabled)",
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-1)" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: valueColor ?? "var(--color-text-primary)",
            letterSpacing: "0.05em",
            textAlign: "right",
            wordBreak: "break-all",
            ...valueStyle,
          }}
        >
          {value}
        </span>
        {badge ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-disabled)",
              letterSpacing: "0.05em",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function RequestTechnicalBlock({
  children,
  maxHeight = 180,
}: {
  children: ReactNode;
  maxHeight?: number;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        color: "var(--color-text-primary)",
        letterSpacing: "0.05em",
        lineHeight: 1.7,
        maxHeight,
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        padding: "var(--space-3)",
        background: "var(--color-bg-input)",
        borderRadius: "var(--radius-sharp)",
      }}
    >
      {children}
    </div>
  );
}

export function RequestActionBar({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "auto", paddingTop: "var(--space-6)" }}>{children}</div>;
}
