import { formatQu } from "@/lib/format";
import { StatRow } from "./stat-row";
import type { EpochLockInfo } from "./use-stake-queries";

interface EpochStatsProps {
  currentEpoch: number | null;
  epochProgress: number | null;
  ticksRemaining: number | null;
  epochInfo: EpochLockInfo | null;
}

/** Current epoch, progress, and Qearn pool totals. */
export function EpochStats({ currentEpoch, epochProgress, ticksRemaining, epochInfo }: EpochStatsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
          Current epoch
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-accent)", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {currentEpoch ?? "—"}
        </span>
      </div>

      {epochProgress !== null ? (
        <div>
          <div style={{ width: "100%", height: 3, background: "var(--color-border-subtle)", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", background: "var(--color-accent)", transform: `scaleX(${epochProgress})`, transformOrigin: "left", transition: "transform 0.3s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-1)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
              {Math.round(epochProgress * 100)}% complete
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
              ~{ticksRemaining != null ? ticksRemaining.toLocaleString() : "—"} ticks left
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column" }}>
        <StatRow label="Total locked" value={epochInfo ? `${formatQu(epochInfo.currentLockedAmount)} QU` : "—"} />
        <StatRow label="Reward pool" value={epochInfo ? `${formatQu(epochInfo.currentBonusAmount)} QU` : "—"} />
      </div>
    </div>
  );
}
