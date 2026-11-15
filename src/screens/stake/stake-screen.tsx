import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";
import { estimateTargetTick } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { QEARN_ADDRESS, QEARN_LOCK_INPUT_TYPE, buildQearnUnlockInput } from "@/lib/contracts";
import { extractMessage, formatQu } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { StakeTabBar, type StakeTab } from "./stake-ui";
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
  const navigate = useNavigate();

  const settings = usePersistedStore((s) => s.settings);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const vaults = usePersistedStore((s) => s.vaults);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const wallets = useSessionStore((s) => s.wallets);
  const wallet = wallets[settings.activeAccountIndex] ?? null;
  const identity = wallet?.identity ?? null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === (identity ?? ""));

  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0] ?? null;

  const { data: tickInfo } = useTickInfo();
  const rpcIdentity = useRpcCacheIdentity("live");
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
  const [unlockAccountIdx, setUnlockAccountIdx] = useState(settings.activeAccountIndex);

  // Lock tab: current epoch info
  const epochInfo = useEpochLockInfo(rpcIdentity, currentEpoch);

  // Unlock tab: identity for the selected unlock account
  const unlockIdentity = getVaultAccountIdentity(vault, unlockAccountIdx, wallets);
  const unlockIsActiveAccount = unlockAccountIdx === settings.activeAccountIndex;

  // Unlock tab: user's locked positions across the last lock period
  const { data: positions, refetch: refetchPositions, isLoading: positionsLoading } = useStakePositions(
    rpcIdentity,
    unlockIdentity,
    currentEpoch,
  );

  const endedStatus = useQearnEndedStatus(rpcIdentity, unlockIdentity);
  const historicalRewards = endedStatus ? endedStatus.fullyRewardedAmount + endedStatus.earlyRewardedAmount : 0n;
  const historicalUnlocked = endedStatus ? endedStatus.fullyUnlockedAmount + endedStatus.earlyUnlockedAmount : 0n;

  const actionsDisabled = !wallet || !tickInfo || hasPendingTx;

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
    if (!wallet || !tickInfo) return;
    setStep("sending");
    try {
      const amount = BigInt(amountStr.trim());
      const targetTick = estimateTargetTick(tickInfo.tick ?? 0, settings.tickOffset);

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QEARN_ADDRESS,
        inputType: QEARN_LOCK_INPUT_TYPE,
        payload: new Uint8Array(0),
        amount,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: wallet.identity,
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
    if (!wallet || !tickInfo || !unlockTarget) return;
    setStep("sending");
    try {
      const { inputType, payload } = buildQearnUnlockInput({
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
        source: wallet.identity,
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
    if (!unlockIsActiveAccount) setActiveAccountIndex(unlockAccountIdx);
    setUnlockTarget(position);
    setStep("confirm");
  }

  // ── Main step (Lock / Unlock) ──────────────────────────────────────────────

  if (step === "main") {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

          <StakeTabBar tab={tab} onChange={setTab} />

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
              onContinue={goLockConfirm}
            />
          ) : (
            <UnlockPanel
              vault={vault}
              wallets={wallets}
              unlockAccountIdx={unlockAccountIdx}
              onSelectAccount={setUnlockAccountIdx}
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
      </AppShell>
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
