import { MoneyBag01Icon } from "@/lib/icons";
import { TextButton } from "@/components/text-button";
import { RowDivider } from "./stake-ui";
import { PositionRow } from "./position-row";
import type { Position } from "./stake-model";

interface PositionsListProps {
  currentEpoch: number | null;
  positionsLoading: boolean;
  positions: Position[] | undefined;
  disabled: boolean;
  onUnlock: (position: Position) => void;
  onSwitchToLock: () => void;
}

/** Unlock tab: loading, empty, and populated position list states. */
export function PositionsList({
  currentEpoch,
  positionsLoading,
  positions,
  disabled,
  onUnlock,
  onSwitchToLock,
}: PositionsListProps) {
  if (!currentEpoch || positionsLoading) {
    return (
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
        Loading...
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "var(--space-3)" }}>
        <span style={{ color: "var(--color-text-disabled)" }}><MoneyBag01Icon size={32} strokeWidth={1.5} /></span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
          No active positions
        </span>
        <TextButton type="button" tone="accent" onClick={onSwitchToLock}>
          SquareLock01Icon QU to start staking
        </TextButton>
      </div>
    );
  }

  return (
    <div>
      {positions.map((pos, i) => (
        <div key={pos.epoch} className="stagger-item">
          {i > 0 && <RowDivider />}
          <PositionRow position={pos} currentEpoch={currentEpoch} disabled={disabled} onUnlock={onUnlock} />
        </div>
      ))}
    </div>
  );
}
