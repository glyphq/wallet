import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  badge?: boolean;
}

export function IconButton({ label, children, badge = false, style, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="glyph-icon-btn"
      {...props}
      style={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: "var(--radius-pill)",
        border: "1px solid transparent",
        background: "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-secondary)",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {children}
      {badge ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 7,
            right: 7,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--color-status-error)",
          }}
        />
      ) : null}
    </button>
  );
}
