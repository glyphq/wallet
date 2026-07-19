interface StepProgressProps {
  current: number;
  total: number;
}

export function StepProgress({ current, total }: StepProgressProps) {
  return (
    <div aria-label={`Step ${current} of ${total}`} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} style={{ display: "flex", gap: "var(--space-2)" }}>
      {Array.from({ length: total }, (_, index) => {
        const active = index + 1 <= current;
        return (
          <div
            key={index}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: active ? "var(--color-accent)" : "var(--color-border-default)",
              transition: "background-color var(--duration-fast) var(--ease-standard)",
            }}
          />
        );
      })}
    </div>
  );
}
