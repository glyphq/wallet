interface StepProgressProps {
  current: number;
  total: number;
}

export function StepProgress({ current, total }: StepProgressProps) {
  return (
    <div
      aria-label={`Step ${current} of ${total}`}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <span
        style={{
          alignSelf: "flex-end",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          color: "var(--color-text-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {current} / {total}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap: "var(--space-2)" }} aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            style={{
              height: 2,
              borderRadius: 999,
              background: index < current ? "var(--color-text-primary)" : "var(--color-border-default)",
              transition: "background-color var(--duration-base) var(--ease-out)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
