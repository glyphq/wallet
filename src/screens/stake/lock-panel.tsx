import { AmountInput } from "@/components/amount-input";
import { formatQu } from "@/lib/format";
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
}

/** Lock tab: epoch context, amount entry, and available balance. */
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
}: LockPanelProps) {
  const entered = amountStr.trim() && /^\d+$/.test(amountStr.trim()) ? BigInt(amountStr.trim()) : 0n;
  const remaining = balance !== null ? balance - entered : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <EpochStats
        currentEpoch={currentEpoch}
        epochProgress={epochProgress}
        ticksRemaining={ticksRemaining}
        epochInfo={epochInfo}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <AmountInput
          label="Amount"
          autoComplete="off"
          value={amountStr}
          disabled={disabled}
          onValueChange={onAmountChange}
          placeholder="0"
          error={amountError || undefined}
        />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
          {balance !== null ? `${formatQu(balance)} QU available` : "Balance unavailable"}
          {remaining !== null && entered > 0n ? ` · ${formatQu(remaining)} QU remaining` : ""}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
          Minimum {formatQu(QEARN_MIN_LOCK)} QU. Positions mature after {LOCK_PERIOD_EPOCHS} epochs.
        </span>
      </div>
    </div>
  );
}
