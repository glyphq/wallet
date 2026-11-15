import { SquareLock01Icon, SquareUnlock01Icon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { Button } from "@/components/button";
import { RowDivider, sectionStyle } from "./stake-ui";
import { StatRow } from "./stat-row";
import { summarizePositions, type Position } from "./stake-model";

interface PositionsSummaryProps {
  positions: Position[] | undefined;
  currentEpoch: number | null;
  historicalRewards: bigint;
  historicalUnlocked: bigint;
  disabled: boolean;
  onReviewUnlock: (position: Position) => void;
}

/** Unlock tab: locked totals, maturity info, and review-unlock shortcut. */
export function PositionsSummary({
  positions,
  currentEpoch,
  historicalRewards,
  historicalUnlocked,
  disabled,
  onReviewUnlock,
}: PositionsSummaryProps) {
  const { totalLocked, readyPositions, readyAmount, nextMaturityEpoch } = summarizePositions(positions, currentEpoch);

  if (!((positions && positions.length > 0) || historicalUnlocked > 0n)) return null;

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <span style={{ color: "var(--color-accent)" }}><SquareLock01Icon size={22} strokeWidth={1.5} /></span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>Positions</span>
      </div>
      <div style={{ padding: "var(--space-2) 0 var(--space-3)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-display)", fontWeight: 700, color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatQu(totalLocked)}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginLeft: "var(--space-2)" }}>QU locked balance</span>
      </div>
      <RowDivider />
      <StatRow label="Active positions" value={positions?.length ?? 0} />
      <RowDivider />
      <StatRow label="Ready amount" value={`${formatQu(readyAmount)} QU`} />
      {nextMaturityEpoch !== null && (
        <>
          <RowDivider />
          <StatRow label="Next maturity" value={`Epoch ${nextMaturityEpoch}`} />
        </>
      )}
      {historicalUnlocked > 0n && (
        <>
          <RowDivider />
          <StatRow label="Historical rewards" value={`${formatQu(historicalRewards)} QU`} />
        </>
      )}
      {readyPositions.length > 0 && (
        <>
          <RowDivider />
          <StatRow label="Ready to unlock" tone="accent" value={readyPositions.length} />
          <Button
            type="button"
            size="md"
            disabled={disabled}
            onClick={() => onReviewUnlock(readyPositions[0])}
            style={{ marginTop: "var(--space-2)", width: "100%" }}
          >
            <SquareUnlock01Icon size={16} strokeWidth={1.5} />
            {readyPositions.length === 1 ? "Review unlock" : "Review next unlock"}
          </Button>
        </>
      )}
    </div>
  );
}
