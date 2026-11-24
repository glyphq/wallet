import { forwardRef, useId, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { FieldError, FieldLabel } from "./field-parts";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  technical?: boolean;
  /** Reserve the error line even when no error is shown. */
  reserveErrorSpace?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, style, id, containerStyle, labelStyle, leftElement, rightElement, className, reserveErrorSpace = true, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? (label ? `${label.toLowerCase().replace(/\s+/g, "-")}-${generatedId}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const describedBy = [props["aria-describedby"], error && errorId].filter(Boolean).join(" ") || undefined;
  const ariaLabel = props["aria-label"] ?? (!label && typeof props.placeholder === "string" ? props.placeholder : undefined);
  const maxLength = props.maxLength ?? (props.type === "password" ? 128 : undefined);

  const inputEl = (
    <input
      {...props}
      ref={ref}
      maxLength={maxLength}
      spellCheck={false}
      autoComplete={props.autoComplete ?? "off"}
      id={inputId}
      className={["glyph-input", className].filter(Boolean).join(" ")}
      data-error={error ? "true" : undefined}
      aria-invalid={error ? "true" : undefined}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      aria-errormessage={error && errorId ? errorId : undefined}
      data-has-leading={leftElement ? "true" : undefined}
      style={{
        borderRadius: 3,
        paddingTop: "var(--space-3)",
        paddingRight: rightElement ? 52 : "var(--space-4)",
        paddingBottom: "var(--space-3)",
        paddingLeft: leftElement ? 48 : "var(--space-4)",
        fontFamily: "var(--font-mono)",
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: "var(--leading-compact)",
        color: "var(--color-text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.015em",
        width: "100%",
        ...style,
      }}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...containerStyle }}>
      {label && (
        <FieldLabel htmlFor={inputId} style={labelStyle}>
          {label}
        </FieldLabel>
      )}
      <div className="glyph-field corner-frame" data-error={error ? "true" : undefined} style={{ position: "relative" }}>
        {leftElement ? (
          <div
            className="glyph-field-icon"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "var(--space-4)",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-tertiary)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {leftElement}
          </div>
        ) : null}
        {inputEl}
        {rightElement ? (
          <div style={{ position: "absolute", right: "var(--space-4)", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
            {rightElement}
          </div>
        ) : null}
      </div>
      {reserveErrorSpace || error ? (
        <div className="field-error-slot">
          {error ? <FieldError id={errorId}>{error}</FieldError> : null}
        </div>
      ) : null}
    </div>
  );
});
