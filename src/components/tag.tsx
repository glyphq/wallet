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
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        color: VARIANT_COLOR[variant],
        padding: "1px var(--space-1)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "var(--radius-pill)",
        lineHeight: "16px",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
