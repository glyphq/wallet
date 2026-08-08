import { useId, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  containerStyle?: CSSProperties;
  leftElement?: ReactNode;
  technical?: boolean;
}

export function Textarea({
  label,
  error,
  hint,
  style,
  id,
  containerStyle,
  leftElement,
  technical = false,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? (label ? `${label.toLowerCase().replace(/\s+/g, "-")}-${generatedId}` : undefined);
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;
  const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  const ariaLabel = props["aria-label"] ?? (!label && typeof props.placeholder === "string" ? props.placeholder : undefined);

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
      <div className="glyph-field" data-error={error ? "true" : undefined} style={{ position: "relative" }}>
        {leftElement ? (
          <div
            className="glyph-field-icon"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "var(--space-4)",
              top: "var(--space-4)",
              display: "flex",
              color: "var(--color-text-tertiary)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {leftElement}
          </div>
        ) : null}
        <textarea
          {...props}
          id={fieldId}
          spellCheck={props.spellCheck ?? false}
          className="glyph-input"
          data-has-leading={leftElement ? "true" : undefined}
          data-error={error ? "true" : undefined}
          aria-invalid={error ? "true" : undefined}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-errormessage={error ? errorId : undefined}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 120,
            paddingTop: "var(--space-3)",
            paddingRight: "var(--space-4)",
            paddingBottom: "var(--space-3)",
            paddingLeft: leftElement ? 48 : "var(--space-4)",
            background: "var(--color-bg-surface-2)",
            borderRadius: "var(--radius-control)",
            color: "var(--color-text-primary)",
            fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)",
            fontSize: technical ? "0.875rem" : "0.9375rem",
            fontWeight: 400,
            lineHeight: technical ? 1.7 : "var(--leading-body)",
            letterSpacing: technical ? "0.015em" : "-0.005em",
            fontVariantNumeric: "tabular-nums",
            ...style,
          }}
        />
      </div>
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
