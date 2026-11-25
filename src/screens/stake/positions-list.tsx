import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
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
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
        Loading positions…
      </span>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <EmptyCollectionState
          title="No active positions"
          description="Lock QU into Qearn to start earning epoch rewards."
          icon="activity"
        />
        <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={onSwitchToLock}>
          Lock QU
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {positions.map((position) => (
        <div key={position.epoch} className="stagger-item" style={{ padding: "var(--space-3) 0" }}>
          <PositionRow position={position} currentEpoch={currentEpoch} disabled={disabled} onUnlock={onUnlock} />
        </div>
      ))}
    </div>
  );
}
