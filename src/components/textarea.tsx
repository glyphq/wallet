import { useId, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from "react";
import { FieldError, FieldLabel } from "./field-parts";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  containerStyle?: CSSProperties;
  leftElement?: ReactNode;
  technical?: boolean;
  /** Absolutely positioned content drawn over the field, such as a mask. */
  overlay?: ReactNode;
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
  overlay,
  className,
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
      {label || error ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-2)", minWidth: 0 }}>
          {label ? <FieldLabel htmlFor={fieldId}>{label}</FieldLabel> : <span />}
          {error ? <FieldError id={errorId} style={{ textAlign: "right" }}>{error}</FieldError> : null}
        </div>
      ) : null}
      <div className="glyph-field corner-frame" data-error={error ? "true" : undefined} style={{ position: "relative" }}>
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
          className={["glyph-input", className].filter(Boolean).join(" ")}
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
            borderRadius: 3,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem",
            fontWeight: 400,
            lineHeight: "var(--leading-compact)",
            letterSpacing: "0.015em",
            fontVariantNumeric: "tabular-nums",
            ...style,
          }}
        />
        {overlay ? <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{overlay}</div> : null}
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
    </div>
  );
}
