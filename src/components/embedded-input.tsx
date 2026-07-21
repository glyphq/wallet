import { forwardRef, type CSSProperties, type InputHTMLAttributes } from "react";

export interface EmbeddedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  technical?: boolean;
  align?: CSSProperties["textAlign"];
}

export const EmbeddedInput = forwardRef<HTMLInputElement, EmbeddedInputProps>(function EmbeddedInput(
  { style, technical = false, align, ...props },
  ref,
) {
  return (
    <input
      {...props}
      ref={ref}
      spellCheck={false}
      autoComplete={props.autoComplete ?? "off"}
      style={{
        background: "none",
        border: "none",
        outline: "none",
        width: "100%",
        minWidth: 0,
        padding: 0,
        fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "var(--text-body)",
        lineHeight: technical ? "var(--leading-compact)" : "var(--leading-body)",
        color: "var(--color-text-display)",
        textAlign: align,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    />
  );
});
