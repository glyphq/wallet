import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AltArrowLeft, Fire, ShieldWarning, ClockCircle, Bolt, Wallet } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { estimateTargetTick, getLatestTick } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { buildQUtilBurnQubicInput, QUTIL_ADDRESS } from "@/lib/contracts";
import { formatQu, extractMessage, truncateId } from "@/lib/format";
import { unlockVault } from "@/lib/vault";
import { getVaultAccountIdentity } from "@/lib/accounts";

type Step = "input" | "confirm" | "sending" | "done" | "error";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

function DetailRow({ icon, label, value, valueColor, mono: useMono = true }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
      <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}>{icon}</span>
      <span style={{ ...labelStyle, flex: 1 }}>{label}</span>
      <span style={{
        fontFamily: useMono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "var(--text-label)", fontWeight: useMono ? 400 : 500,
        color: valueColor ?? "var(--color-text-display)",
        textAlign: "right", maxWidth: "55%", wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}

const stepMotion = {
  initial: { y: 4 },
  animate: { y: 0 },
  exit: { y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

export default function BurnScreen() {
  const navigate = useNavigate();

  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const wallets = useSessionStore((s) => s.wallets);
  const wallet = wallets[settings.activeAccountIndex] ?? null;
  const identity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";
  const accountName = vault?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(identity || null);
  const balance = balanceData?.balance ?? null;

  const [step, setStep] = useState<Step>("input");
  const [amountStr, setAmountStr] = useState("");
  const [amountError, setAmountError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [savedTargetTick, setSavedTargetTick] = useState(0);
  const [burnPassword, setBurnPassword] = useState("");
  const [burnPasswordError, setBurnPasswordError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  function goConfirm() {
    const trimmed = amountStr.trim();
    if (!trimmed || !/^\d+$/.test(trimmed) || BigInt(trimmed) <= 0n) {
      setAmountError("Invalid amount"); amountRef.current?.focus(); return;
    }
    if (balance !== null && BigInt(trimmed) > balance) {
      setAmountError("Insufficient balance"); amountRef.current?.focus(); return;
    }
    setAmountError("");
    if (settings.requirePasswordForBurn && vault?.encryptedData) {
      setNeedsPassword(true);
    }
    setStep("confirm");
  }

  async function send() {
    if (!wallet) return;
    setSending(true);
    if (needsPassword && vault?.encryptedData) {
      try {
        await unlockVault(vault.encryptedData, burnPassword);
      } catch {
        setBurnPasswordError("Wrong password");
        setSending(false);
        return;
      }
    }
    await finalizeSend();
  }

  async function finalizeSend() {
    if (!wallet) return;
    setStep("sending");
    try {
      const amount = BigInt(amountStr.trim());
      const currentTick = await getLatestTick();
      const targetTick = estimateTargetTick(currentTick, settings.tickOffset);
      const { inputType, payload } = buildQUtilBurnQubicInput({ amount });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QUTIL_ADDRESS,
        inputType, payload, amount, targetTick, currentTick,
      });
      await broadcastTx(encoded);
      addPendingTx({ hash, source: identity, destination: QUTIL_ADDRESS, amount: amount.toString(), targetTick, broadcastAt: Date.now(), contractName: "QUtil · Burn" });
      setSavedTargetTick(targetTick); setTxHash(hash); setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      setStep("error");
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  const header = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => step === "input" ? navigate("/send") : step === "confirm" ? setStep("input") : navigate("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2) 0", display: "flex", alignItems: "center" }}>
        <AltArrowLeft size={20} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
        {step === "input" ? `Burn · ${accountName}` : step === "confirm" ? "Confirm burn" : step === "done" ? "Burned" : step === "sending" ? "Burning" : "Error"}
      </span>
    </div>
  );

  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-surface)",
    borderRadius: "var(--radius-card)",
    padding: "var(--space-1) var(--space-4)",
  };
  const divider: React.CSSProperties = {
    height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))",
  };

  // ── Input ──────────────────────────────────────────────────────────────────

  if (step === "input") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        {/* Warning */}
        <div style={{ background: "rgba(255, 59, 48, 0.06)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <ShieldWarning size={16} style={{ flexShrink: 0, color: "var(--color-status-error)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-error)" }}>
            Burned QU is permanently destroyed. This cannot be undone.
          </span>
        </div>

        {/* Amount */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 280 }}>
            <input
              ref={amountRef}
              autoComplete="off"
              value={amountStr}
              onChange={(e) => { setAmountStr(e.target.value.replace(/[^0-9]/g, "")); setAmountError(""); }}
              onKeyDown={(e) => e.key === "Enter" && goConfirm()}
              placeholder="0"
              autoFocus
              style={{
                width: "100%", background: "none", border: "none", outline: "none",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-display)", fontWeight: 700,
                color: amountError ? "var(--color-status-error)" : amountStr ? "var(--color-text-display)" : "var(--color-text-disabled)",
                letterSpacing: "-0.03em", textAlign: "center", padding: 0,
              }}
            />
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>QU</span>

          {balance !== null && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: "var(--space-2)" }}>
              {formatQu(balance)} available
            </span>
          )}

          {amountError && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-error)", marginTop: "var(--space-1)" }}>
              {amountError}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ paddingBottom: "var(--space-6)" }}>
          <Button variant="danger" onClick={goConfirm} disabled={!amountStr.trim() || !wallet || !tickInfo}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              <Fire size={16} weight="Bold" /> Continue
            </span>
          </Button>
        </div>
      </motion.div>
      </AppShell>
    );
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  if (step === "confirm") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        {/* Amount */}
        <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-status-error)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {formatQu(amountStr)}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)", marginTop: "var(--space-1)", opacity: 0.7 }}>QU to burn</div>
        </div>

        {/* Warning card */}
        <div style={{ background: "rgba(255, 59, 48, 0.06)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <ShieldWarning size={16} style={{ flexShrink: 0, color: "var(--color-status-error)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-error)" }}>
            This QU will be permanently destroyed. There is no undo.
          </span>
        </div>

        {/* Details card */}
        <div style={cardStyle}>
          <DetailRow icon={<Wallet size={16} />} label="From" value={`${accountName} · ${truncateId(identity)}`} valueColor="var(--color-text-secondary)" />
          <div style={divider} />
          <DetailRow icon={<ClockCircle size={16} />} label="Target tick" value={tickInfo ? String(estimateTargetTick(tickInfo.tick ?? 0, settings.tickOffset)) : "—"} />
          <div style={divider} />
          <DetailRow icon={<Bolt size={16} />} label="Fee" value="None" mono={false} />
        </div>

        {/* Password confirmation (inline) */}
        {needsPassword && (
          <div style={cardStyle}>
            <div style={{ padding: "11px 0", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <span style={{ ...labelStyle }}>Vault password required</span>
              <input
                type="password"
                value={burnPassword}
                onChange={(e) => { setBurnPassword(e.target.value); setBurnPasswordError(""); }}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="••••••••••"
                autoComplete="current-password"
                style={{
                  width: "100%", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                  color: "var(--color-text-display)", outline: "none", boxSizing: "border-box",
                }}
              />
              {burnPasswordError && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-error)" }}>{burnPasswordError}</span>
              )}
            </div>
          </div>
        )}

        {hasPendingTx && (
          <div style={{ background: "rgba(245, 158, 11, 0.08)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <ClockCircle size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Transfer pending — wait for confirmation</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button variant="danger" onClick={send} loading={sending} disabled={!wallet || !tickInfo || hasPendingTx || (needsPassword && !burnPassword)}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              <Fire size={16} weight="Bold" /> Burn {formatQu(amountStr)} QU
            </span>
          </Button>
          <button type="button" onClick={() => setStep("input")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
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
          <span style={{ position: "absolute", inset: 0, border: "3px solid var(--color-border-subtle)", borderTopColor: "var(--color-status-error)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <Fire size={18} style={{ color: "var(--color-status-error)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Burning</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
            {formatQu(amountStr)} QU
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
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Amount */}
        <div className="flash-success" style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-disabled)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {formatQu(amountStr)}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <Fire size={14} style={{ color: "var(--color-status-error)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-error)" }}>Burned</span>
          </div>
        </div>

        {/* Details card */}
        <div style={cardStyle}>
          <DetailRow icon={<Bolt size={16} />} label="Hash" value={truncateId(txHash)} />
          <div style={divider} />
          <DetailRow icon={<ClockCircle size={16} />} label="Tick" value={String(savedTargetTick)} valueColor="var(--color-text-secondary)" />
          <div style={divider} />
          <DetailRow icon={<Wallet size={16} />} label="Status" value="Pending" valueColor="var(--color-text-disabled)" mono={false} />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button onClick={() => navigate("/dashboard")}>Done</Button>
          <button type="button" onClick={() => navigate("/history")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
            View history
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
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Burn failed</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)", maxWidth: 280 }}>
          {txError || "The burn transaction could not be broadcast."}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 280, paddingTop: "var(--space-2)" }}>
        <Button variant="danger" onClick={() => setStep("confirm")}>Try again</Button>
        <button type="button" onClick={() => navigate("/send")}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
          Cancel
        </button>
      </div>
        </motion.div>
    </AppShell>
  );
}

