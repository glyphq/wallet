import type { DailyActivityStat, MonthlySummaryStat } from "@/lib/history-analytics";
import { buildActivityHeatmap, buildMonthlyBars, compactQu } from "./analytics-helpers";

export function MonthlyBars({ summaries }: { summaries: MonthlySummaryStat[] }) {
  const bars = buildMonthlyBars(summaries);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)" }} aria-label="Monthly flow legend">
        <LegendText label="Incoming" color="var(--color-accent)" />
        <span style={{ color: "var(--color-border-strong)" }} aria-hidden="true">/</span>
        <LegendText label="Outgoing" color="var(--color-text-tertiary)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
      {bars.map((bar, index) => (
        <div key={bar.sortKey} style={{ display: "grid", gridTemplateColumns: "62px minmax(0, 1fr) 46px", alignItems: "center", gap: "var(--space-3)", minHeight: 54, borderTop: index > 0 ? "1px solid var(--color-border-subtle)" : undefined }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-primary)" }}>{bar.month}</div>
            <div style={{ marginTop: 2, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{bar.count} tx</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <VolumeBar width={bar.incomingWidth} color="var(--color-accent)" label={`${compactQu(bar.incoming)} QU incoming`} />
            <VolumeBar width={bar.outgoingWidth} color="var(--color-text-tertiary)" label={`${compactQu(bar.outgoing)} QU outgoing`} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", textAlign: "right" }}>
            {compactQu(bar.total)}
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}

function LegendText({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function VolumeBar({ width, color, label }: { width: number; color: string; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ height: 5, overflow: "hidden", borderRadius: 999, background: "var(--color-border-strong)" }}>
      <div style={{ width: `${Math.max(width, width > 0 ? 2 : 0)}%`, height: "100%", borderRadius: 999, background: color }} />
    </div>
  );
}

export function ActivityHeatmap({ days }: { days: DailyActivityStat[] }) {
  const { weeks, activeDays, totalTransactions, max } = buildActivityHeatmap(days);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }} aria-label={`${totalTransactions} transactions across ${activeDays} active days`}>
        {weeks.map((week) => (
          <div key={week.map((cell) => cell.date).join("|")} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {week.map((cell) => {
              const intensity = cell.count === 0 ? 0 : Math.max(0.18, cell.count / max);
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "transaction" : "transactions"}`}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    maxHeight: 16,
                    borderRadius: 3,
                    background: cell.count === 0
                      ? "var(--color-border-strong)"
                      : `color-mix(in srgb, var(--color-accent) ${Math.round(intensity * 100)}%, var(--color-border-strong))`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
        <span>{activeDays} active days</span>
        <span>{totalTransactions} transactions</span>
      </div>
    </div>
  );
}
