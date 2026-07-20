import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  rightElement?: ReactNode;
  technical?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, style, id, containerStyle, labelStyle, rightElement, technical = false, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = inputId ? `${inputId}-error` : undefined;
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
      aria-describedby={error && errorId ? errorId : undefined}
      style={{
        background: "var(--color-bg-input)",
        borderRadius: "var(--radius-control)",
        padding: rightElement ? "var(--space-3) 40px var(--space-3) var(--space-4)" : "var(--space-3) var(--space-4)",
        fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: technical ? "var(--text-mono-lg)" : "var(--text-body)",
        lineHeight: technical ? "var(--leading-compact)" : "var(--leading-body)",
        color: "var(--color-text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: technical ? "0.01em" : 0,
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
      {rightElement ? (
        <div style={{ position: "relative" }}>
          {inputEl}
          <div style={{ position: "absolute", right: "var(--space-3)", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
            {rightElement}
          </div>
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
