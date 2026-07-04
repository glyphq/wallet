import type { CSSProperties, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerStyle?: CSSProperties;
}

export function Input({ label, error, style, id, containerStyle, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = inputId ? `${inputId}-error` : undefined;
  const maxLength = props.maxLength ?? (props.type === "password" ? 128 : undefined);

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
      <input
        {...props}
        maxLength={maxLength}
        autoComplete={props.autoComplete ?? "off"}
        id={inputId}
        className="glyph-input"
        data-error={error ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        style={{
          background: "var(--color-bg-subtle)",
          borderRadius: "var(--radius-card)",
          padding: "12px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-lg)",
          color: "var(--color-text-display)",
          width: "100%",
          ...style,
        }}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-status-error)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
