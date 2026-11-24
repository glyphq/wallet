import type { WalletMeta } from "@/store/persisted";
import type { SessionAccount } from "@/lib/session-account";
import { AccountPicker } from "./account-picker";
import { PositionsSummary } from "./positions-summary";
import { PositionsList } from "./positions-list";
import type { Position } from "./stake-model";

interface UnlockPanelProps {
  wallet: WalletMeta | null;
  sessionAccounts: SessionAccount[];
  unlockAccountIdx: number;
  onSelectAccount: (index: number) => void;
  currentEpoch: number | null;
  positions: Position[] | undefined;
  positionsLoading: boolean;
  historicalRewards: bigint;
  historicalUnlocked: bigint;
  disabled: boolean;
  onReviewUnlock: (position: Position) => void;
  onSwitchToLock: () => void;
}

/** Unlock tab: account selector, position summary, and position list. */
export function UnlockPanel({
  wallet,
  sessionAccounts,
  unlockAccountIdx,
  onSelectAccount,
  currentEpoch,
  positions,
  positionsLoading,
  historicalRewards,
  historicalUnlocked,
  disabled,
  onReviewUnlock,
  onSwitchToLock,
}: UnlockPanelProps) {
  const visibleAccounts = wallet?.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index) ?? [];

  return (
    <>
      <AccountPicker
        wallet={wallet}
        accounts={visibleAccounts}
        selectedIndex={unlockAccountIdx}
        sessionAccounts={sessionAccounts}
        onSelect={onSelectAccount}
      />

      <PositionsSummary
        positions={positions}
        currentEpoch={currentEpoch}
        historicalRewards={historicalRewards}
        historicalUnlocked={historicalUnlocked}
        disabled={disabled}
        onReviewUnlock={onReviewUnlock}
      />

      <PositionsList
        currentEpoch={currentEpoch}
        positionsLoading={positionsLoading}
        positions={positions}
        disabled={disabled}
        onUnlock={onReviewUnlock}
        onSwitchToLock={onSwitchToLock}
      />
    </>
  );
}
