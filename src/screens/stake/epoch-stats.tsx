import { AsciiReveal, AsciiSkeleton } from "ascii-reveal";
import { FlashIcon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { RowDivider, sectionStyle } from "./stake-ui";
import { StatRow } from "./stat-row";
import type { EpochLockInfo } from "./use-stake-queries";

interface EpochStatsProps {
  currentEpoch: number | null;
  epochProgress: number | null;
  ticksRemaining: number | null;
  epochInfo: EpochLockInfo | null;
}

/** Current epoch header, progress, and Qearn pool totals. */
export function EpochStats({ currentEpoch, epochProgress, ticksRemaining, epochInfo }: EpochStatsProps) {
  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ color: "var(--color-accent)" }}><FlashIcon size={22} strokeWidth={1.5} /></span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            Current Epoch
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-display)", fontWeight: 700, color: "var(--color-accent)", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {currentEpoch ?? "—"}
        </span>
      </div>
      {epochProgress !== null && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <div style={{ width: "100%", height: 4, borderRadius: 2, background: "var(--color-bg-base)", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 2, background: "var(--color-accent)", transform: `scaleX(${epochProgress})`, transformOrigin: "left", transition: "transform 0.3s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-1)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
              {Math.round(epochProgress * 100)}% complete
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
              ~{ticksRemaining != null ? ticksRemaining.toLocaleString() : "—"} ticks left
            </span>
          </div>
        </div>
      )}
      <RowDivider />
      <AsciiReveal
        loading={!epochInfo}
        revealOnMount={false}
        shimmer={false}
        duration="fast"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {epochInfo ? (
          <>
            <StatRow label="Total locked" tone="primary" value={`${formatQu(epochInfo.currentLockedAmount)} QU`} />
            <RowDivider />
            <StatRow label="Reward pool" tone="accent" value={`${formatQu(epochInfo.currentBonusAmount)} QU`} />
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) 0" }}>
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[100]} animate={false} />
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[140]} animate={false} seed={2} />
            </div>
            <RowDivider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) 0" }}>
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[100]} animate={false} seed={3} />
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[120]} animate={false} seed={4} />
            </div>
          </>
        )}
      </AsciiReveal>
    </div>
  );
}
