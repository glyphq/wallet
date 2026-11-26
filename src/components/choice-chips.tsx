import type { CSSProperties } from "react";

export interface ChoiceChipOption<T extends string | number> {
  value: T;
  label: string;
}

/** Compact pill/chip choices shared by wallet names and send amount presets. */
export function ChoiceChips<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  style,
}: {
  label: string;
  options: readonly ChoiceChipOption<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className="choice-chips" role="group" aria-label={label} style={style}>
      {options.map((option) => {
        const active = selected === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            className="choice-chip corner-frame"
            data-selected={active ? "true" : "false"}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
