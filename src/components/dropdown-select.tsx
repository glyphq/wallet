import { useId, type ReactNode } from "react";
import { FieldLabel } from "./field-parts";
import { ArrowDown01Icon } from "@/lib/icons";

export interface DropdownOption {
  value: string;
  label: string;
}

export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  hint,
  disabled = false,
  id,
}: {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  hint?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? `dropdown-${generatedId}`;
  const hintId = hint ? `${selectId}-hint` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
      <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
      <div className="glyph-field corner-frame" style={{ opacity: disabled ? 0.55 : 1 }}>
        <select
          id={selectId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-describedby={hintId}
          style={{
            appearance: "none",
            width: "100%",
            minHeight: "var(--height-input)",
            padding: "0 44px 0 var(--space-4)",
            border: 0,
            borderRadius: 2,
            background: "var(--color-bg-surface)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            letterSpacing: "0.04em",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "var(--space-4)",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            color: "var(--color-text-tertiary)",
            pointerEvents: "none",
          }}
        >
          <ArrowDown01Icon size={16} />
        </span>
      </div>
      {hint ? (
        <span id={hintId} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.03em", overflowWrap: "anywhere" }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
