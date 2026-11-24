import { Button } from "@/components/button";

export interface OptionSelectorOption<T extends string> {
  value: T;
  label: string;
}

export interface OptionSelectorProps<T extends string> {
  label: string;
  value: T;
  options: readonly OptionSelectorOption<T>[];
  onChange: (value: T) => void;
  columns?: number;
}

/** Equal-width single-choice selector built from the shared Button. */
export function OptionSelector<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = options.length,
}: OptionSelectorProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "var(--space-2)",
      }}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          role="radio"
          aria-checked={option.value === value}
          variant={option.value === value ? "primary" : "secondary"}
          size="sm"
          style={{ width: "100%" }}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
