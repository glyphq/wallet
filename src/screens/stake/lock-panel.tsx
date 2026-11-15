import { InformationCircleIcon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { EpochStats } from "./epoch-stats";
import { QEARN_MIN_LOCK, LOCK_PERIOD_EPOCHS } from "./stake-model";
import type { EpochLockInfo } from "./use-stake-queries";

interface LockPanelProps {
  currentEpoch: number | null;
  epochProgress: number | null;
  ticksRemaining: number | null;
  epochInfo: EpochLockInfo | null;
  amountStr: string;
  amountError: string;
  balance: bigint | null;
  disabled: boolean;
  onAmountChange: (value: string) => void;
  onContinue: () => void;
}

/** Lock tab: epoch stats, amount entry, and continue action. */
export function LockPanel({
  currentEpoch,
  epochProgress,
  ticksRemaining,
  epochInfo,
  amountStr,
  amountError,
  balance,
  disabled,
  onAmountChange,
  onContinue,
}: LockPanelProps) {
  const entered = amountStr.trim() && /^\d+$/.test(amountStr.trim()) ? BigInt(amountStr.trim()) : 0n;
  const remaining = balance !== null ? balance - entered : null;
  const balanceOver = remaining !== null && remaining < 0n;

  return (
    <>
      <EpochStats
        currentEpoch={currentEpoch}
        epochProgress={epochProgress}
        ticksRemaining={ticksRemaining}
        epochInfo={epochInfo}
      />

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <span style={{ color: "var(--color-text-disabled)", flexShrink: 0, marginTop: 1 }}><InformationCircleIcon size={16} strokeWidth={1.5} /></span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", lineHeight: 1.5 }}>
          Minimum {formatQu(QEARN_MIN_LOCK)} QU. Mature after {LOCK_PERIOD_EPOCHS} epochs.
        </span>
      </div>

      {/* Amount input */}
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
        <Input
          autoComplete="off"
          value={amountStr}
          onChange={(e) => onAmountChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onContinue()}
          placeholder="0"
          aria-label="QU amount to lock"
          autoFocus
          inputMode="numeric"
          error={amountError || undefined}
          style={{
            maxWidth: 280, background: "transparent", borderColor: "transparent", boxShadow: "none",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-display)", fontWeight: 700,
            color: amountError ? "var(--color-status-error)" : amountStr ? "var(--color-text-display)" : "var(--color-text-disabled)",
            letterSpacing: "-0.03em", textAlign: "center", padding: 0,
          }}
          containerStyle={{ alignItems: "center", width: "100%" }}
        />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>QU</span>

        {remaining !== null && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: balanceOver ? "var(--color-status-error)" : "var(--color-text-disabled)", marginTop: "var(--space-2)" }}>
            {formatQu(remaining)} available
          </span>
        )}

      </div>

      {/* Continue */}
      <div style={{ paddingBottom: "var(--space-6)" }}>
        <Button
          onClick={onContinue}
          disabled={!amountStr.trim() || disabled}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
