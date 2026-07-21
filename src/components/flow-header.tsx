import type { ReactNode } from "react";

interface FlowHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  trailing?: ReactNode;
}

export function FlowHeader({
  eyebrow,
  title,
  description,
  align = "left",
  trailing,
}: FlowHeaderProps) {
  const centered = align === "center";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", textAlign: centered ? "center" : "left" }}>
      {eyebrow ? (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-compact)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
          }}
        >
          {eyebrow}
        </span>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: centered ? "center" : "flex-start" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-title)",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "-0.025em",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              lineHeight: "var(--leading-body)",
              color: "var(--color-text-secondary)",
              maxWidth: centered ? 320 : "none",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
