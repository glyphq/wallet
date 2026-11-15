import { SquareUnlock01Icon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { Button } from "@/components/button";
import { Identicon } from "@/components/identicon";
import { LOCK_PERIOD_EPOCHS, type Position } from "./stake-model";

interface PositionRowProps {
  position: Position;
  currentEpoch: number;
  disabled: boolean;
  onUnlock: (position: Position) => void;
}

/** One locked position: epoch badge, amount, maturity status, and unlock action. */
export function PositionRow({ position, currentEpoch, disabled, onUnlock }: PositionRowProps) {
  const unlockEpoch = position.epoch + LOCK_PERIOD_EPOCHS;
  const isEarly = currentEpoch < unlockEpoch;
  const epochsLeft = isEarly ? unlockEpoch - currentEpoch : 0;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) 0", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
        <div style={{ position: "relative" }}>
          <Identicon kind="position" code={`E${position.epoch}`} seed={`qearn-pos-${position.epoch}`} label={`Epoch ${position.epoch}`} size={40} radius={8} style={{ flexShrink: 0 }} />
          <span style={{
            position: "absolute", bottom: -2, right: -2,
            width: 12, height: 12, borderRadius: "50%",
            background: isEarly ? "var(--color-text-disabled)" : "var(--color-accent)",
            border: "2px solid var(--color-bg-base)",
          }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
            {formatQu(position.lockedAmount)} QU
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
              Epoch {position.epoch} → {unlockEpoch}
            </span>
            {isEarly ? (
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                color: "var(--color-text-secondary)",
                padding: "0 var(--space-1)",
                background: "var(--color-bg-surface)",
                borderRadius: "var(--radius-pill)",
                lineHeight: "18px",
              }}>
                {epochsLeft} epoch{epochsLeft !== 1 ? "s" : ""} left
              </span>
            ) : (
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500,
                color: "var(--color-accent)",
                padding: "0 var(--space-1)",
                background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                borderRadius: "var(--radius-pill)",
                lineHeight: "18px",
              }}>
                Ready
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant={isEarly ? "secondary" : "primary"}
        size="sm"
        disabled={disabled}
        onClick={() => onUnlock(position)}
        style={{ flexShrink: 0, width: "auto" }}
      >
        {!isEarly && <SquareUnlock01Icon size={14} strokeWidth={1.5} />}
        {isEarly ? "Early" : "Unlock"}
      </Button>
    </div>
  );
}
