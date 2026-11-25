import { formatQu } from "@/lib/format";
import { StatRow } from "./stat-row";
import { summarizePositions, type Position } from "./stake-model";

interface PositionsSummaryProps {
  positions: Position[] | undefined;
  currentEpoch: number | null;
  historicalRewards: bigint;
  historicalUnlocked: bigint;
}

/** Unlock tab: locked totals and maturity context for the active account. */
export function PositionsSummary({
  positions,
  currentEpoch,
  historicalRewards,
  historicalUnlocked,
}: PositionsSummaryProps) {
  const { totalLocked, readyAmount, nextMaturityEpoch } = summarizePositions(positions, currentEpoch);

  if (!((positions && positions.length > 0) || historicalUnlocked > 0n)) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
        Positions
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {formatQu(totalLocked)}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
          QU locked
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <StatRow label="Active positions" value={positions?.length ?? 0} />
        <StatRow label="Ready amount" value={`${formatQu(readyAmount)} QU`} />
        {nextMaturityEpoch !== null ? <StatRow label="Next maturity" value={`Epoch ${nextMaturityEpoch}`} /> : null}
        {historicalUnlocked > 0n ? <StatRow label="Historical rewards" value={`${formatQu(historicalRewards)} QU`} /> : null}
      </div>
    </div>
  );
}
