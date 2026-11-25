import { PositionsSummary } from "./positions-summary";
import { PositionsList } from "./positions-list";
import type { Position } from "./stake-model";

interface UnlockPanelProps {
  currentEpoch: number | null;
  positions: Position[] | undefined;
  positionsLoading: boolean;
  historicalRewards: bigint;
  historicalUnlocked: bigint;
  disabled: boolean;
  onReviewUnlock: (position: Position) => void;
  onSwitchToLock: () => void;
}

/** Unlock tab: locked summary and position list for the active account. */
export function UnlockPanel({
  currentEpoch,
  positions,
  positionsLoading,
  historicalRewards,
  historicalUnlocked,
  disabled,
  onReviewUnlock,
  onSwitchToLock,
}: UnlockPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <PositionsSummary
        positions={positions}
        currentEpoch={currentEpoch}
        historicalRewards={historicalRewards}
        historicalUnlocked={historicalUnlocked}
      />

      <PositionsList
        currentEpoch={currentEpoch}
        positionsLoading={positionsLoading}
        positions={positions}
        disabled={disabled}
        onUnlock={onReviewUnlock}
        onSwitchToLock={onSwitchToLock}
      />
    </div>
  );
}
