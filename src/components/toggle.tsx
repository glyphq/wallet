import { useId, type CSSProperties } from "react";

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
}

/** Flat settings switch with a sharp track and square thumb. */
export function Toggle({ label, description, checked, onChange, disabled = false, style }: ToggleProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="glyph-toggle-row"
      style={style}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span id={labelId} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {label}
        </span>
        {description ? (
          <span id={descriptionId} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", lineHeight: "var(--leading-compact)" }}>
            {description}
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className="glyph-toggle-track" data-checked={checked}>
        <span className="glyph-toggle-thumb" />
      </span>
    </button>
  );
}
