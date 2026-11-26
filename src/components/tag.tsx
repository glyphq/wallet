import type { CSSProperties } from "react";

export type TagVariant = "success" | "warning" | "error" | "neutral";

export interface TagProps {
  children: string;
  variant?: TagVariant;
  style?: CSSProperties;
}

const VARIANT_COLOR: Record<TagVariant, string> = {
  success: "var(--color-status-success)",
  warning: "var(--color-status-warning)",
  error: "var(--color-status-error)",
  neutral: "var(--color-text-secondary)",
};

export function Tag({ children, variant = "neutral", style }: TagProps) {
  return (
    <span
      className="corner-frame"
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        color: VARIANT_COLOR[variant],
        padding: "1px var(--space-2)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-sharp)",
        lineHeight: "18px",
        whiteSpace: "nowrap",
        "--corner-color": VARIANT_COLOR[variant],
        "--corner-size": "5px",
        "--corner-inset": "1px",
        ...style,
      } as CSSProperties}
    >
      {children}
    </span>
  );
}
