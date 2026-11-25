import { SquareUnlock01Icon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { Tag } from "@/components/tag";
import { LOCK_PERIOD_EPOCHS, type Position } from "./stake-model";

interface PositionRowProps {
  position: Position;
  currentEpoch: number;
  disabled: boolean;
  onUnlock: (position: Position) => void;
}

/** One locked position with maturity status and unlock action. */
export function PositionRow({ position, currentEpoch, disabled, onUnlock }: PositionRowProps) {
  const unlockEpoch = position.epoch + LOCK_PERIOD_EPOCHS;
  const isEarly = currentEpoch < unlockEpoch;
  const epochsLeft = isEarly ? unlockEpoch - currentEpoch : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
      <FramedAvatar seed={`qearn-pos-${position.epoch}`} size={34} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {formatQu(position.lockedAmount)} QU
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.04em" }}>
            Epoch {position.epoch} → {unlockEpoch}
          </span>
          <Tag variant={isEarly ? "neutral" : "success"}>
            {isEarly ? `${epochsLeft} ${epochsLeft === 1 ? "epoch" : "epochs"} left` : "Ready"}
          </Tag>
        </span>
      </div>
      <Button
        type="button"
        variant={isEarly ? "secondary" : "primary"}
        size="sm"
        disabled={disabled}
        onClick={() => onUnlock(position)}
        style={{ flexShrink: 0, width: "auto" }}
      >
        {!isEarly ? <SquareUnlock01Icon size={14} strokeWidth={1.5} aria-hidden="true" /> : null}
        {isEarly ? "Early" : "Unlock"}
      </Button>
    </div>
  );
}
