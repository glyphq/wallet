import type { VaultMeta } from "@/store/persisted";
import type { SessionWallet } from "@/lib/session-wallet";
import { AccountPicker } from "./account-picker";
import { PositionsSummary } from "./positions-summary";
import { PositionsList } from "./positions-list";
import type { Position } from "./stake-model";

interface UnlockPanelProps {
  vault: VaultMeta | null;
  wallets: SessionWallet[];
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
  vault,
  wallets,
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
  const visibleAccounts = vault?.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index) ?? [];

  return (
    <>
      <AccountPicker
        vault={vault}
        accounts={visibleAccounts}
        selectedIndex={unlockAccountIdx}
        wallets={wallets}
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
