import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerStyle?: CSSProperties;
  rightElement?: ReactNode;
}

export function Input({ label, error, style, id, containerStyle, rightElement, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = inputId ? `${inputId}-error` : undefined;
  const maxLength = props.maxLength ?? (props.type === "password" ? 128 : undefined);

  const inputEl = (
    <input
      {...props}
      maxLength={maxLength}
      spellCheck={false}
      autoComplete={props.autoComplete ?? "off"}
      id={inputId}
      className="glyph-input"
      data-error={error ? "true" : undefined}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error && errorId ? errorId : undefined}
      style={{
        background: "var(--color-bg-subtle)",
        borderRadius: "var(--radius-card)",
        padding: rightElement ? "var(--space-3) 38px var(--space-3) var(--space-4)" : "var(--space-3) var(--space-4)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-lg)",
        color: "var(--color-text-display)",
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
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-label)",
            color: "var(--color-text-secondary)",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </label>
      )}
      {rightElement ? (
        <div style={{ position: "relative" }}>
          {inputEl}
          <div style={{
            position: "absolute", right: "var(--space-3)", top: "50%",
            transform: "translateY(-50%)", display: "flex", alignItems: "center",
          }}>
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
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
