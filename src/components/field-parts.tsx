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
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        color: "var(--color-text-tertiary)",
        fontWeight: 500,
        lineHeight: "var(--leading-compact)",
        letterSpacing: "0.015em",
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
}

export function FieldError({ id, children }: FieldErrorProps) {
  return (
    <span
      id={id}
      role="alert"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        color: "var(--color-status-error)",
        lineHeight: "var(--leading-compact)",
      }}
    >
      {children}
    </span>
  );
}
