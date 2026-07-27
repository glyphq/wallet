interface StepProgressProps {
  current: number;
  total: number;
}

export function StepProgress({ current, total }: StepProgressProps) {
  return (
    <div aria-label={`Step ${current} of ${total}`} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", letterSpacing: "0.08em" }}>
        {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--color-border-default)" }} aria-hidden="true" />
    </div>
  );
}
