import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { qk } from "@/lib/query-keys";
import {
  qearnGetUserLockStatus,
  qearnGetUserLockedInfo,
  qearnGetLockInfoPerEpoch,
  qearnGetEndedStatus,
} from "@/lib/contracts";
import { LOCK_PERIOD_EPOCHS, Q_EARN_POSITION_BATCH_SIZE, SC_OPTS, type Position } from "./stake-model";

type OkValue<T> = T extends { ok: true; value: infer V } ? V : never;

export type EpochLockInfo = OkValue<Awaited<ReturnType<typeof qearnGetLockInfoPerEpoch>>>;
export type QearnEndedStatus = OkValue<Awaited<ReturnType<typeof qearnGetEndedStatus>>>;

/** Current-epoch Qearn lock totals and reward pool. */
export function useEpochLockInfo(rpcIdentity: string, currentEpoch: number | null): EpochLockInfo | null {
  const { data } = useQuery({
    queryKey: qk.qearnEpochInfo(rpcIdentity, currentEpoch),
    queryFn: () => qearnGetLockInfoPerEpoch(getRpcClient().live, { Epoch: currentEpoch! }),
    enabled: !!currentEpoch,
    staleTime: 60_000,
  });
  return data?.ok ? data.value : null;
}

/** User's locked positions across the last lock period, ready positions first. */
export function useStakePositions(rpcIdentity: string, unlockIdentity: string | null, currentEpoch: number | null) {
  return useQuery({
    queryKey: qk.qearnPositions(rpcIdentity, unlockIdentity, currentEpoch),
    queryFn: async (): Promise<Position[]> => {
      if (!unlockIdentity || !currentEpoch) return [];
      const live = getRpcClient().live;

      const statusResult = await qearnGetUserLockStatus(live, { user: unlockIdentity }, SC_OPTS);
      if (!statusResult.ok || statusResult.value.status === 0n) return [];

      const epochRange = Array.from({ length: 52 }, (_, i) => currentEpoch - i).filter((e) => e > 0);
      const infos = new Map<number, bigint>();

      for (let i = 0; i < epochRange.length; i += Q_EARN_POSITION_BATCH_SIZE) {
        const batch = epochRange.slice(i, i + Q_EARN_POSITION_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((epoch) => qearnGetUserLockedInfo(live, { user: unlockIdentity, epoch }, SC_OPTS)),
        );

        batch.forEach((epoch, batchIndex) => {
          const result = batchResults[batchIndex];
          if (result?.ok) {
            infos.set(epoch, result.value.lockedAmount);
          }
        });
      }

      // Sort: ready first (unlocked), then by fewest epochs remaining (closest to unlocking)
      return epochRange
        .map((epoch) => ({ epoch, lockedAmount: infos.get(epoch) ?? 0n }))
        .filter((p) => p.lockedAmount > 0n)
        .sort((a, b) => {
          const aReady = currentEpoch >= a.epoch + LOCK_PERIOD_EPOCHS ? 0 : 1;
          const bReady = currentEpoch >= b.epoch + LOCK_PERIOD_EPOCHS ? 0 : 1;
          if (aReady !== bReady) return aReady - bReady;
          return b.epoch - a.epoch; // higher epoch = more recent = sooner to unlock
        });
    },
    enabled: !!unlockIdentity && !!currentEpoch,
    staleTime: 30_000,
  });
}

/** Historical rewards and unlocked totals for the given identity. */
export function useQearnEndedStatus(rpcIdentity: string, unlockIdentity: string | null): QearnEndedStatus | null {
  const { data } = useQuery({
    queryKey: ["qearn", "ended-status", rpcIdentity, unlockIdentity],
    queryFn: () => qearnGetEndedStatus(getRpcClient().live, { user: unlockIdentity! }, SC_OPTS),
    enabled: !!unlockIdentity,
    staleTime: 60_000,
  });
  return data?.ok ? data.value : null;
}
