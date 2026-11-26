import type { CSSProperties, ReactNode } from "react";

export interface FieldLabelProps {
  htmlFor?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function FieldLabel({ htmlFor, children, style }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-tertiary)",
        fontWeight: 500,
        lineHeight: "var(--leading-compact)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </label>
  );
}

export interface FieldErrorProps {
  id?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function FieldError({ id, children, style }: FieldErrorProps) {
  return (
    <span
      id={id}
      role="alert"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        color: "var(--color-status-error)",
        lineHeight: "var(--leading-compact)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
