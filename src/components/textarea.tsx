import type { CSSProperties, ReactNode, TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  containerStyle?: CSSProperties;
  technical?: boolean;
}

export function Textarea({
  label,
  error,
  hint,
  style,
  id,
  containerStyle,
  technical = false,
  ...props
}: TextareaProps) {
  const fieldId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;
  const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...containerStyle }}>
      {label ? (
        <label
          htmlFor={fieldId}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label)",
            color: "var(--color-text-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </label>
      ) : null}
      <textarea
        {...props}
        id={fieldId}
        spellCheck={props.spellCheck ?? false}
        className="glyph-input"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 120,
          padding: "var(--space-3) var(--space-4)",
          background: "var(--color-bg-surface-2)",
          borderRadius: "var(--radius-control)",
          color: "var(--color-text-primary)",
          fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: technical ? "var(--text-mono-sm)" : "var(--text-body)",
          lineHeight: technical ? 1.6 : "var(--leading-body)",
          fontVariantNumeric: "tabular-nums",
          ...style,
        }}
      />
      {hint ? (
        <span
          id={hintId}
          style={{
            fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-compact)",
            color: "var(--color-text-tertiary)",
          }}
        >
          {hint}
        </span>
      ) : null}
      {error ? (
        <span
          id={errorId}
          role="alert"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-compact)",
            color: "var(--color-status-error)",
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
