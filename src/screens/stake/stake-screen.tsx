import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { estimateTargetTick } from "@/lib/api/network";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { QEARN, QEARN_ADDRESS, QEARN_LOCK_INPUT_TYPE, QEARN_UNLOCK_INPUT_TYPE } from "@/lib/contracts";
import { extractMessage, formatQu } from "@/lib/format";
import { StakeActionChips, StakeFlowShell, type StakeTab } from "./stake-ui";
import {
  QEARN_MIN_LOCK,
  epochProgressOf,
  ticksRemainingOf,
  type Position,
  type StakeStep,
} from "./stake-model";
import { useEpochLockInfo, useStakePositions, useQearnEndedStatus } from "./use-stake-queries";
import { LockPanel } from "./lock-panel";
import { UnlockPanel } from "./unlock-panel";
import { LockConfirm } from "./lock-confirm";
import { UnlockConfirm } from "./unlock-confirm";
import { SendingStep } from "./sending-step";
import { DoneStep } from "./done-step";
import { ErrorStep } from "./error-step";

export default function StakeScreen() {
  const activeAccountIndex = usePersistedStore((s) => s.settings.activeAccountIndex);
  return <StakeSession key={activeAccountIndex} />;
}

function StakeSession() {
  const navigate = useNavigate();

  const settings = usePersistedStore((s) => s.settings);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const accounts = useSessionStore((s) => s.accounts);
  const account = accounts[settings.activeAccountIndex] ?? null;
  const identity = account?.identity ?? null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === (identity ?? ""));

  const { data: tickInfo } = useTickInfo();
  const apiIdentity = useApiCacheIdentity();
  const { data: balanceData } = useBalance(identity);
  const balance = balanceData?.balance ?? null;
  const currentEpoch = tickInfo?.epoch ?? null;
  const epochProgress = epochProgressOf(tickInfo);
  const ticksRemaining = ticksRemainingOf(tickInfo);

  const [tab, setTab] = useState<StakeTab>("lock");
  const [step, setStep] = useState<StakeStep>("main");
  const [amountStr, setAmountStr] = useState("");
  const [amountError, setAmountError] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<Position | null>(null);
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");

  // Lock tab: current epoch info
  const epochInfo = useEpochLockInfo(apiIdentity, currentEpoch);

  // Unlock tab: user's locked positions across the last lock period
  const { data: positions, refetch: refetchPositions, isLoading: positionsLoading } = useStakePositions(
    apiIdentity,
    identity,
    currentEpoch,
  );

  const endedStatus = useQearnEndedStatus(apiIdentity, identity);
  const historicalRewards = endedStatus ? endedStatus.fullyRewardedAmount + endedStatus.earlyRewardedAmount : 0n;
  const historicalUnlocked = endedStatus ? endedStatus.fullyUnlockedAmount + endedStatus.earlyUnlockedAmount : 0n;

  const actionsDisabled = !account || !tickInfo || hasPendingTx;

  function goLockConfirm() {
    const trimmed = amountStr.trim();
    if (!trimmed || !/^\d+$/.test(trimmed) || BigInt(trimmed) <= 0n) {
      setAmountError("Invalid amount");
      return;
    }
    if (BigInt(trimmed) < BigInt(QEARN_MIN_LOCK)) {
      setAmountError(`Minimum ${QEARN_MIN_LOCK.toLocaleString()} QU`);
      return;
    }
    if (balance !== null && BigInt(trimmed) > balance) {
      setAmountError("Insufficient balance");
      return;
    }
    setAmountError("");
    setStep("confirm");
  }

  async function sendLock() {
    if (!account || !tickInfo) return;
    setStep("sending");
    try {
      const amount = BigInt(amountStr.trim());
      const targetTick = estimateTargetTick(tickInfo.tick ?? 0, settings.tickOffset);

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QEARN_ADDRESS,
        inputType: QEARN_LOCK_INPUT_TYPE,
        payload: QEARN.encodeProcedure("lock", {}),
        amount,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: account.identity,
        destination: QEARN_ADDRESS,
        amount: amount.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: "Qearn · Lock",
      });

      setTxHash(hash);
      setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      setStep("error");
    }
  }

  async function sendUnlock() {
    if (!account || !tickInfo || !unlockTarget) return;
    setStep("sending");
    try {
      const inputType = QEARN_UNLOCK_INPUT_TYPE;
      const payload = QEARN.encodeProcedure("unlock", {
        amount: unlockTarget.lockedAmount,
        lockedEpoch: unlockTarget.epoch,
      });
      const targetTick = estimateTargetTick(tickInfo.tick ?? 0, settings.tickOffset);

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QEARN_ADDRESS,
        inputType,
        payload,
        amount: 0n,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: account.identity,
        destination: QEARN_ADDRESS,
        amount: "0",
        targetTick,
        broadcastAt: Date.now(),
        contractName: "Qearn · Unlock",
      });

      setTxHash(hash);
      setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      setStep("error");
    }
  }

  function handleAmountChange(value: string) {
    setAmountStr(value.replace(/[^0-9]/g, ""));
    setAmountError("");
  }

  function reviewUnlock(position: Position) {
    setUnlockTarget(position);
    setStep("confirm");
  }

  // ── Main step (Lock / Unlock) ──────────────────────────────────────────────

  if (step === "main") {
    const canContinue = Boolean(amountStr.trim()) && !actionsDisabled;
    return (
      <StakeFlowShell footer={tab === "lock" ? (
        <Button onClick={goLockConfirm} disabled={!canContinue}>
          Continue
        </Button>
      ) : undefined}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

          <StakeActionChips tab={tab} onChange={setTab} />

          {tab === "lock" ? (
            <LockPanel
              currentEpoch={currentEpoch}
              epochProgress={epochProgress}
              ticksRemaining={ticksRemaining}
              epochInfo={epochInfo}
              amountStr={amountStr}
              amountError={amountError}
              balance={balance}
              disabled={actionsDisabled}
              onAmountChange={handleAmountChange}
            />
          ) : (
            <UnlockPanel
              currentEpoch={currentEpoch}
              positions={positions}
              positionsLoading={positionsLoading}
              historicalRewards={historicalRewards}
              historicalUnlocked={historicalUnlocked}
              disabled={actionsDisabled}
              onReviewUnlock={reviewUnlock}
              onSwitchToLock={() => setTab("lock")}
            />
          )}

        </motion.div>
      </StakeFlowShell>
    );
  }

  // ── Lock confirm ───────────────────────────────────────────────────────────

  if (step === "confirm" && tab === "lock") {
    return (
      <LockConfirm
        amountStr={amountStr}
        currentEpoch={currentEpoch}
        disabled={actionsDisabled}
        onSend={sendLock}
        onCancel={() => setStep("main")}
      />
    );
  }

  // ── Unlock confirm ─────────────────────────────────────────────────────────

  if (step === "confirm" && tab === "unlock" && unlockTarget) {
    return (
      <UnlockConfirm
        position={unlockTarget}
        currentEpoch={currentEpoch}
        disabled={actionsDisabled}
        onSend={sendUnlock}
        onCancel={() => { setStep("main"); setUnlockTarget(null); }}
      />
    );
  }

  // ── Sending ────────────────────────────────────────────────────────────────

  if (step === "sending") {
    return (
      <SendingStep
        tab={tab}
        amount={tab === "lock" ? formatQu(amountStr) : unlockTarget ? formatQu(unlockTarget.lockedAmount) : ""}
      />
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <DoneStep
        tab={tab}
        txHash={txHash}
        onDone={() => navigate("/dashboard")}
        onBack={() => { setStep("main"); refetchPositions(); }}
      />
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  return (
    <ErrorStep
      txError={txError}
      onRetry={() => setStep("confirm")}
      onCancel={() => navigate("/dashboard")}
    />
  );
}
