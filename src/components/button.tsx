import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "lg" | "md" | "sm";
type Shape = "pill" | "sharp";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--color-text-primary)",
    color: "var(--color-text-inverse)",
    borderColor: "var(--color-text-primary)",
  },
  secondary: {
    background: "var(--color-bg-surface)",
    color: "var(--color-text-primary)",
    borderColor: "var(--color-border-default)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    borderColor: "transparent",
  },
  danger: {
    background: "transparent",
    color: "var(--color-status-error)",
    borderColor: "var(--color-status-error)",
  },
};

const SIZE: Record<Size, CSSProperties> = {
  lg: { minHeight: "var(--height-button-lg)", padding: "0 var(--space-5)", width: "100%" },
  md: { minHeight: "var(--height-button-md)", padding: "0 var(--space-4)" },
  sm: { minHeight: "var(--height-button-sm)", padding: "0 var(--space-3)", fontSize: "var(--text-label)" },
};

const SHAPE: Record<Shape, CSSProperties> = {
  pill: { borderRadius: "var(--radius-pill)" },
  sharp: { borderRadius: "var(--radius-pill)" },
};

export function Button({
  variant = "primary",
  size = "lg",
  shape = "pill",
  loading = false,
  children,
  style,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={`glyph-btn ${className}`}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        position: "relative",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        letterSpacing: "0.005em",
        fontSize: "var(--text-body)",
        border: "1px solid",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...VARIANT[variant],
        ...SIZE[size],
        ...SHAPE[shape],
        ...style,
      }}
    >
      {loading && (
        <span
          style={{
            position: "absolute",
            width: 16, height: 16,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      )}
      <span style={{ visibility: loading ? "hidden" : "visible", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", width: "100%" }}>
        {children}
      </span>
    </button>
  );
}
