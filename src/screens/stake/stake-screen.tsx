import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AltArrowLeft,
  AltArrowDown,
  ShieldWarning,
  MoneyBag,
  Lock,
  LockUnlocked,
  Bolt,
  InfoCircle,
} from "@solar-icons/react";
import type { Identity } from "@qubic.org/types";
import { AppShell } from "@/layouts/app-shell";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { identityToPublicKey } from "@/lib/crypto";
import { getRpcClient, estimateTargetTick } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import {
  QEARN_ADDRESS,
  QEARN_LOCK_INPUT_TYPE,
  buildQearnUnlockInput,
  qearnGetUserLockStatus,
  qearnGetUserLockedInfo,
  qearnGetLockInfoPerEpoch,
} from "@/lib/contracts";
import { qk } from "@/lib/query-keys";
import { formatQu, truncateId, extractMessage } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";

type Tab = "lock" | "unlock";
type Step = "main" | "confirm" | "sending" | "done" | "error";

const QEARN_MIN_LOCK = 10_000_000;
const LOCK_PERIOD_EPOCHS = 52;
const Q_EARN_POSITION_BATCH_SIZE = 8;

interface Position {
  epoch: number;
  lockedAmount: bigint;
}

const idToPk = (id: string) => identityToPublicKey(id as Identity);
const SC_OPTS = { identityToPublicKey: idToPk };

const stepMotion = {
  initial: { y: 4 },
  animate: { y: 0 },
  exit: { y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

const accentPill: React.CSSProperties = {
  background: "var(--color-accent)",
  color: "#111",
  border: "none",
  borderRadius: 999,
  padding: "12px 24px",
  fontFamily: "var(--font-sans)",
  fontSize: "0.875rem",
  fontWeight: 500,
  cursor: "pointer",
  width: "100%",
};

const textBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: "0.8125rem",
  color: "var(--color-text-disabled)",
  padding: "8px 0",
  alignSelf: "center",
};

const rowDivider: React.CSSProperties = {
  height: 1,
  background: "var(--color-border-subtle)",
  margin: "0 -16px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  borderRadius: "var(--radius-card)",
  padding: "var(--space-4)",
};

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
  const visibleAccounts = vault?.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index) ?? [];

  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(identity);
  const balance = balanceData?.balance ?? null;
  const currentEpoch = tickInfo?.epoch ?? null;

  const [tab, setTab] = useState<Tab>("lock");
  const [step, setStep] = useState<Step>("main");
  const [amountStr, setAmountStr] = useState("");
  const [amountError, setAmountError] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<Position | null>(null);
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [unlockAccountIdx, setUnlockAccountIdx] = useState(settings.activeAccountIndex);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const accountPickerRef = useRef<HTMLDivElement>(null);

  // Lock tab: current epoch info
  const { data: epochInfoResult } = useQuery({
    queryKey: qk.qearnEpochInfo(currentEpoch),
    queryFn: () => qearnGetLockInfoPerEpoch(getRpcClient().live, { Epoch: currentEpoch! }),
    enabled: !!currentEpoch,
    staleTime: 60_000,
  });
  const epochInfo = epochInfoResult?.ok ? epochInfoResult.value : null;

  // Unlock tab: identity for the selected unlock account
  const unlockIdentity = getVaultAccountIdentity(vault, unlockAccountIdx, wallets);
  const unlockIsActiveAccount = unlockAccountIdx === settings.activeAccountIndex;

  // Close account picker on outside click
  useEffect(() => {
    if (!accountPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(e.target as Node)) setAccountPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountPickerOpen]);

  // Unlock tab: user's locked positions across last 52 epochs
  const { data: positions, refetch: refetchPositions, isLoading: positionsLoading } = useQuery({
    queryKey: qk.qearnPositions(unlockIdentity, currentEpoch),
    queryFn: async () => {
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

  const totalUserLocked = positions?.reduce((sum, p) => sum + p.lockedAmount, 0n) ?? 0n;
  const readyPositions = positions?.filter((p) => currentEpoch !== null && currentEpoch >= p.epoch + LOCK_PERIOD_EPOCHS) ?? [];

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

  function handleBack() {
    if (step === "main" || step === "done" || step === "error") {
      navigate("/dashboard");
    } else {
      setStep("main");
      setUnlockTarget(null);
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  const header = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
      <button
        type="button"
        onClick={handleBack}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "8px 0", display: "flex", alignItems: "center" }}
      >
        <AltArrowLeft size={20} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
        Earn
      </span>
    </div>
  );

  const entered = amountStr.trim() && /^\d+$/.test(amountStr.trim()) ? BigInt(amountStr.trim()) : 0n;
  const remaining = balance !== null ? balance - entered : null;
  const balanceOver = remaining !== null && remaining < 0n;

  // ── Tab bar (shared) ──────────────────────────────────────────────────────

  function TabBar() {
    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
      { key: "lock", label: "Lock", icon: <Lock size={14} weight="Linear" /> },
      { key: "unlock", label: "Unlock", icon: <LockUnlocked size={14} weight="Linear" /> },
    ];
    return (
      <div style={{ position: "relative", display: "flex", background: "var(--color-bg-surface)", borderRadius: 999, padding: 4, gap: 2 }}>
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              position: "relative",
              zIndex: 1,
              background: "transparent",
              color: tab === key ? "#111" : "var(--color-text-disabled)",
              border: "none",
              borderRadius: 999,
              padding: "10px 0",
              fontFamily: "var(--font-sans)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              transition: "color 0.15s ease",
            }}
          >
            {tab === key && (
              <motion.span
                layoutId="earn-tab-pill"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: "var(--color-accent)",
                  zIndex: -1,
                }}
              />
            )}
            {icon}
            {label}
          </button>
        ))}
      </div>
    );
  }

  // ── Main step (Lock / Unlock) ──────────────────────────────────────────────

  if (step === "main") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

          <TabBar />

          {tab === "lock" ? (
            <>
              {/* Epoch stats card */}
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  <span style={{ color: "var(--color-text-disabled)" }}><Bolt size={22} weight="Linear" /></span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    Epoch {currentEpoch ?? "—"}
                  </span>
                </div>
                <div style={rowDivider} />
                {epochInfo ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                      <span style={labelStyle}>Total locked</span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-primary)" }}>{formatQu(epochInfo.currentLockedAmount)} QU</span>
                    </div>
                    <div style={rowDivider} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                      <span style={labelStyle}>Reward pool</span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-accent)" }}>{formatQu(epochInfo.currentBonusAmount)} QU</span>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "11px 0", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)" }}>Loading...</div>
                )}
              </div>

              {/* How it works */}
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                <span style={{ color: "var(--color-text-disabled)", flexShrink: 0, marginTop: 1 }}><InfoCircle size={16} weight="Linear" /></span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-text-disabled)", lineHeight: 1.5 }}>
                  Lock QU for {LOCK_PERIOD_EPOCHS} epochs to earn from the reward pool. Minimum {formatQu(QEARN_MIN_LOCK)} QU. Early unlock is available but rewards may be reduced.
                </span>
              </div>

              {/* Amount input */}
              <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
                <input
                  autoComplete="off"
                  value={amountStr}
                  onChange={(e) => { setAmountStr(e.target.value.replace(/[^0-9]/g, "")); setAmountError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && goLockConfirm()}
                  placeholder="0"
                  autoFocus
                  style={{
                    width: "100%", maxWidth: 280, background: "none", border: "none", outline: "none",
                    fontFamily: "var(--font-sans)", fontSize: "3rem", fontWeight: 700,
                    color: amountError ? "var(--color-status-error)" : amountStr ? "var(--color-text-display)" : "var(--color-text-disabled)",
                    letterSpacing: "-0.03em", textAlign: "center", padding: 0,
                  }}
                />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)" }}>QU</span>

                {remaining !== null && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: balanceOver ? "var(--color-status-error)" : "var(--color-text-disabled)", marginTop: "var(--space-2)" }}>
                    {formatQu(remaining)} available
                  </span>
                )}

                {amountError && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, color: "var(--color-status-error)", marginTop: "var(--space-1)" }}>
                    {amountError}
                  </span>
                )}
              </div>

              {/* Continue */}
              <div style={{ paddingBottom: "var(--space-6)" }}>
                <button
                  type="button"
                  onClick={goLockConfirm}
                  disabled={!amountStr.trim() || !wallet || !tickInfo || hasPendingTx}
                  style={{ ...accentPill, opacity: !amountStr.trim() || !wallet || !tickInfo || hasPendingTx ? 0.5 : 1 }}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Account selector */}
              {visibleAccounts.length > 1 && (
                <div ref={accountPickerRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setAccountPickerOpen((p) => !p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 2,
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                      {vault?.accounts.find((a) => a.index === unlockAccountIdx)?.name ?? `Account ${unlockAccountIdx + 1}`}
                    </span>
                    <AltArrowDown
                      size={12}
                      weight="Linear"
                      style={{ color: "var(--color-text-disabled)", transform: accountPickerOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
                    />
                  </button>
                  {accountPickerOpen && (
                    <div style={{
                      position: "absolute", top: "calc(100% + var(--space-2))", left: 0, zIndex: 100,
                      minWidth: 200, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-strong)",
                      borderRadius: "var(--radius-card)", padding: "var(--space-1)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    }}>
                      {visibleAccounts.map((account) => {
                        const isActive = account.index === unlockAccountIdx;
                        const accIdentity = getVaultAccountIdentity(vault, account.index, wallets);
                        return (
                          <button
                            key={account.index}
                            type="button"
                            onClick={() => { setUnlockAccountIdx(account.index); setAccountPickerOpen(false); }}
                            style={{
                              display: "flex", flexDirection: "column", gap: 2, width: "100%",
                              padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sharp)", border: "none",
                              background: isActive ? "var(--color-bg-surface)" : "transparent",
                              cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                              {account.name}
                            </span>
                            {accIdentity && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                                {truncateId(accIdentity)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Summary card */}
              {positions && positions.length > 0 && (
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <span style={{ color: "var(--color-text-disabled)" }}><Lock size={22} weight="Linear" /></span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      Your positions
                    </span>
                  </div>
                  <div style={rowDivider} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                    <span style={labelStyle}>Total locked</span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)" }}>{formatQu(totalUserLocked)} QU</span>
                  </div>
                  <div style={rowDivider} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                    <span style={labelStyle}>Active positions</span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-primary)" }}>{positions.length}</span>
                  </div>
                  {readyPositions.length > 0 && (
                    <>
                      <div style={rowDivider} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                        <span style={labelStyle}>Ready to unlock</span>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-accent)" }}>{readyPositions.length}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Positions list */}
              {!currentEpoch || positionsLoading ? (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)" }}>
                  Loading...
                </div>
              ) : !positions || positions.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "var(--space-3)" }}>
                  <span style={{ color: "var(--color-text-disabled)" }}><MoneyBag size={32} weight="Linear" /></span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)" }}>
                    No active positions
                  </span>
                  <button type="button" onClick={() => setTab("lock")} style={{ ...textBtn, color: "var(--color-accent)" }}>
                    Lock QU to start earning
                  </button>
                </div>
              ) : (
                <div>
                  {positions.map((pos, i) => {
                    const unlockEpoch = pos.epoch + LOCK_PERIOD_EPOCHS;
                    const isEarly = currentEpoch < unlockEpoch;
                    const epochsLeft = isEarly ? unlockEpoch - currentEpoch : 0;
                    return (
                      <div key={pos.epoch}>
                        {i > 0 && <div style={rowDivider} />}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) 0", gap: "var(--space-3)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                              {formatQu(pos.lockedAmount)} QU
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-text-disabled)" }}>
                                Epoch {pos.epoch}
                              </span>
                              {isEarly ? (
                                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                                  · {epochsLeft} epoch{epochsLeft !== 1 ? "s" : ""} left
                                </span>
                              ) : (
                                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, color: "var(--color-accent)" }}>
                                  · Ready
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!wallet || !tickInfo || hasPendingTx}
                            onClick={() => {
                              if (!unlockIsActiveAccount) {
                                setActiveAccountIndex(unlockAccountIdx);
                              }
                              setUnlockTarget(pos);
                              setStep("confirm");
                            }}
                            style={{
                              background: isEarly ? "var(--color-bg-surface)" : "var(--color-accent)",
                              color: isEarly ? "var(--color-text-secondary)" : "#111",
                              border: "none",
                              borderRadius: 999,
                              padding: "8px 16px",
                              fontFamily: "var(--font-sans)",
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              cursor: "pointer",
                              flexShrink: 0,
                              opacity: !wallet || !tickInfo || hasPendingTx ? 0.5 : 1,
                            }}
                          >
                            {isEarly ? "Early" : "Unlock"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </motion.div>
      </AppShell>
    );
  }

  // ── Lock confirm ───────────────────────────────────────────────────────────

  if (step === "confirm" && tab === "lock") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

          <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "3rem", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {formatQu(amountStr)}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: 4 }}>QU</div>
          </div>

          {/* Detail card */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Contract</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>Qearn</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Action</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>Lock QU</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Lock epoch</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>{currentEpoch}</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Unlocks at epoch</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>{(currentEpoch ?? 0) + LOCK_PERIOD_EPOCHS}</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Lock period</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>{LOCK_PERIOD_EPOCHS} epochs</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
            <button
              type="button"
              onClick={sendLock}
              disabled={!wallet || !tickInfo || hasPendingTx}
              style={{ ...accentPill, opacity: !wallet || !tickInfo || hasPendingTx ? 0.5 : 1 }}
            >
              Sign and send
            </button>
            <button type="button" onClick={() => setStep("main")} style={textBtn}>
              Cancel
            </button>
          </div>

        </motion.div>
      </AppShell>
    );
  }

  // ── Unlock confirm ─────────────────────────────────────────────────────────

  if (step === "confirm" && tab === "unlock" && unlockTarget) {
    const unlockEpoch = unlockTarget.epoch + LOCK_PERIOD_EPOCHS;
    const isEarly = currentEpoch !== null && currentEpoch < unlockEpoch;
    const epochsLeft = isEarly ? unlockEpoch - (currentEpoch ?? 0) : 0;

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

          <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "3rem", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {formatQu(unlockTarget.lockedAmount)}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: 4 }}>QU</div>
          </div>

          {/* Detail card */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Contract</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>Qearn</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Action</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>Unlock QU</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Lock epoch</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>{unlockTarget.epoch}</span>
            </div>
            <div style={rowDivider} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
              <span style={labelStyle}>Maturity</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: isEarly ? "var(--color-status-warning)" : "var(--color-accent)" }}>
                {isEarly ? `${epochsLeft} epochs early` : "Mature"}
              </span>
            </div>
          </div>

          {isEarly && (
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--color-status-warning)", flexShrink: 0, marginTop: 1 }}><ShieldWarning size={16} /></span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-status-warning)", lineHeight: 1.5 }}>
                Early unlock — rewards may be reduced or forfeited. The position matures at epoch {unlockEpoch}.
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
            <button
              type="button"
              onClick={sendUnlock}
              disabled={!wallet || !tickInfo || hasPendingTx}
              style={{ ...accentPill, opacity: !wallet || !tickInfo || hasPendingTx ? 0.5 : 1 }}
            >
              Sign and send
            </button>
            <button type="button" onClick={() => { setStep("main"); setUnlockTarget(null); }} style={textBtn}>
              Cancel
            </button>
          </div>

        </motion.div>
      </AppShell>
    );
  }

  // ── Sending ────────────────────────────────────────────────────────────────

  if (step === "sending") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-5)" }}>
          <div style={{ width: 48, height: 48, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ position: "absolute", inset: 0, border: "3px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <span style={{ position: "relative", zIndex: 1, color: "var(--color-accent)" }}>
              {tab === "lock" ? <Lock size={20} weight="Bold" /> : <Lock size={20} weight="Bold" />}
            </span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)" }}>
              {tab === "lock" ? "Locking" : "Unlocking"}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", marginTop: 4 }}>
              {tab === "lock" ? formatQu(amountStr) : (unlockTarget ? formatQu(unlockTarget.lockedAmount) : "")} QU
            </div>
          </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

          {/* Status */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "var(--space-4)", gap: "var(--space-2)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(204, 252, 251, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MoneyBag size={22} style={{ color: "var(--color-accent)" }} />
            </div>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-accent)" }}>
              {tab === "lock" ? "Locked" : "Unlocked"}
            </span>
          </div>

          {/* Transaction hash card */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
              Transaction hash
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-primary)", wordBreak: "break-all" }}>
              {txHash}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
            <button type="button" onClick={() => navigate("/dashboard")} style={accentPill}>
              Done
            </button>
            <button type="button" onClick={() => { setStep("main"); refetchPositions(); }} style={textBtn}>
              Back to earn
            </button>
          </div>

        </motion.div>
      </AppShell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  return (
    <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255, 59, 48, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldWarning size={22} style={{ color: "var(--color-status-error)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)" }}>
            Transaction failed
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", marginTop: 4, maxWidth: 280 }}>
            {txError || "The transaction could not be broadcast."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 280, paddingTop: "var(--space-2)" }}>
          <button type="button" onClick={() => setStep("confirm")} style={accentPill}>
            Try again
          </button>
          <button type="button" onClick={() => navigate("/dashboard")} style={textBtn}>
            Cancel
          </button>
        </div>
      </motion.div>
    </AppShell>
  );
}
