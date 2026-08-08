import { forwardRef, useId, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  technical?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, style, id, containerStyle, labelStyle, leftElement, rightElement, technical = false, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? (label ? `${label.toLowerCase().replace(/\s+/g, "-")}-${generatedId}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const describedBy = [props["aria-describedby"], error && errorId].filter(Boolean).join(" ") || undefined;
  const maxLength = props.maxLength ?? (props.type === "password" ? 128 : undefined);

  const inputEl = (
    <input
      {...props}
      ref={ref}
      maxLength={maxLength}
      spellCheck={false}
      autoComplete={props.autoComplete ?? "off"}
      id={inputId}
      className="glyph-input"
      data-error={error ? "true" : undefined}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={describedBy}
      aria-errormessage={error && errorId ? errorId : undefined}
      data-has-leading={leftElement ? "true" : undefined}
      style={{
        background: "var(--color-bg-input)",
        borderRadius: "var(--radius-control)",
        paddingTop: "var(--space-3)",
        paddingRight: rightElement ? 52 : "var(--space-4)",
        paddingBottom: "var(--space-3)",
        paddingLeft: leftElement ? 48 : "var(--space-4)",
        fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: technical ? "0.875rem" : "0.9375rem",
        fontWeight: 400,
        lineHeight: technical ? "var(--leading-compact)" : "var(--leading-body)",
        color: "var(--color-text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: technical ? "0.015em" : "-0.005em",
        width: "100%",
        ...style,
      }}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...containerStyle }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label)",
            color: "var(--color-text-secondary)",
            fontWeight: 500,
            letterSpacing: "0.01em",
            ...labelStyle,
          }}
        >
          {label}
        </label>
      )}
      {leftElement || rightElement ? (
        <div className="glyph-field" data-error={error ? "true" : undefined} style={{ position: "relative" }}>
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
            <div style={{ position: "absolute", right: "var(--space-2)", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
              {rightElement}
            </div>
          ) : null}
        </div>
      ) : inputEl}
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            color: "var(--color-status-error)",
            lineHeight: "var(--leading-compact)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
});
