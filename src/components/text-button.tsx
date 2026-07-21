import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Tone = "default" | "muted" | "accent" | "danger" | "success" | "warning";

const TONE: Record<Tone, CSSProperties> = {
  default: { color: "var(--color-text-secondary)" },
  muted: { color: "var(--color-text-disabled)" },
  accent: { color: "var(--color-accent)" },
  danger: { color: "var(--color-status-error)" },
  success: { color: "var(--color-status-success)" },
  warning: { color: "var(--color-status-warning)" },
};

export interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  children: ReactNode;
}

export function TextButton({ tone = "default", children, style, disabled, ...props }: TextButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        lineHeight: 1.2,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1)",
        opacity: disabled ? 0.45 : 1,
        ...TONE[tone],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
