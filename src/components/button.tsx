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
    background: "var(--color-accent)",
    color: "var(--color-accent-contrast)",
    borderColor: "transparent",
  },
  secondary: {
    background: "var(--color-bg-surface)",
    color: "var(--color-text-primary)",
    borderColor: "transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    borderColor: "transparent",
  },
  danger: {
    background: "transparent",
    color: "var(--color-status-error)",
    borderColor: "transparent",
  },
};

const SIZE: Record<Size, CSSProperties> = {
  lg: { minHeight: 52, padding: "0 var(--space-5)", width: "100%", fontSize: 15 },
  md: { minHeight: 48, padding: "0 var(--space-5)", fontSize: 15 },
  sm: { minHeight: 36, padding: "0 var(--space-4)", fontSize: 13 },
};

const SHAPE: Record<Shape, CSSProperties> = {
  pill: { borderRadius: "var(--radius-pill)" },
  sharp: { borderRadius: "var(--radius-sharp)" },
};

export function Button({
  variant = "primary",
  size = "lg",
  shape = "sharp",
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
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      className={`glyph-btn corner-frame ${className}`}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        position: "relative",
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        letterSpacing: "0",
        fontSize: 15,
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
          aria-hidden="true"
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
      {loading ? <span className="sr-only">Loading</span> : null}
      <span style={{ visibility: loading ? "hidden" : "visible", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", width: "100%" }}>
        {children}
      </span>
    </button>
  );
}
