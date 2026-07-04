import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { ArrowRightUp, QrCode, AltArrowLeft, UserId, Wallet, ClockCircle, Bolt, ShieldCheck, ShieldWarning, Bookmark, CheckCircle } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ContactPicker } from "@/components/contact-picker";
import { AddressSuggestions } from "@/components/address-suggestions";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { isValidIdentity, newId } from "@/lib/crypto";
import { estimateTargetTick, getLatestTick } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildTransferFromSession } from "@/lib/secure-session";
import { unlockVault } from "@/lib/vault";
import { truncateId, formatQu, extractMessage } from "@/lib/format";
import { TxMemoField } from "@/components/tx-memo-field";
import { buildAddressSuggestions, getRecentRecipientIdentities } from "@/lib/address-intelligence";
import { getVaultAccountIdentity, isWatchOnlyVault } from "@/lib/accounts";
import { exceedsHighValueThreshold } from "@/lib/session-policies";

type Step = "input" | "review" | "sending" | "done" | "error";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};


// ── Numpad ───────────────────────────────────────────────────────────────────

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

function Numpad({ onPress, onMax }: { onPress: (key: string) => void; onMax?: () => void }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "var(--space-1)",
      maxWidth: 320,
      width: "100%",
      margin: "0 auto",
    }}>
      {PAD_KEYS.map((key, i) => {
        const isMaxSlot = i === 9;
        const label = isMaxSlot ? "MAX" : key;
        const isActive = !!key || isMaxSlot;
        return (
          <button
            key={i}
            type="button"
            disabled={!isActive}
            onClick={() => {
              if (isMaxSlot) onMax?.();
              else if (key) onPress(key);
            }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 58,
              background: "transparent",
              border: "none",
              cursor: isActive ? "pointer" : "default",
              fontFamily: "var(--font-sans)",
              fontSize: isMaxSlot ? "var(--text-label)" : "1.375rem",
              fontWeight: isMaxSlot ? 500 : 400,
              color: isMaxSlot ? "var(--color-accent)" : key === "⌫" ? "var(--color-text-secondary)" : "var(--color-text-display)",
              borderRadius: "var(--radius-card)",
              transition: "transform 0.08s, background 0.08s",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
            onPointerDown={(e) => {
              if (!isActive) return;
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.transform = "scale(0.95)";
            }}
            onPointerUp={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Detail row (for review/done screens) ────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SendScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const contacts = usePersistedStore((s) => s.contacts);
  const addContact = usePersistedStore((s) => s.addContact);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const wallets = useSessionStore((s) => s.wallets);
  const txDraft = useSessionStore((s) => s.txDraft);
  const saveTxDraft = useSessionStore((s) => s.saveTxDraft);
  const clearTxDraft = useSessionStore((s) => s.clearTxDraft);

  const wallet = wallets[settings.activeAccountIndex] ?? null;
  const watchOnly = isWatchOnlyVault(vault);
  const { data: tickInfo } = useTickInfo();
  const identity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";
  const { data: balanceData } = useBalance(identity || null);
  const balance = balanceData?.balance ?? null;
  const { data: stats } = useLatestStats();

  const [step, setStep] = useState<Step>("input");
  const [draftRestored, setDraftRestored] = useState(false);
  const [destination, setDestination] = useState(() => searchParams.get("to") ?? "");
  const [amountStr, setAmountStr] = useState(() => searchParams.get("amount") ?? "");
  const [destError, setDestError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [savedTargetTick, setSavedTargetTick] = useState(0);
  const [watchResult, setWatchResult] = useState<"pending" | "confirmed" | "failed">("pending");
  const [highValuePassword, setHighValuePassword] = useState("");
  const [highValuePasswordError, setHighValuePasswordError] = useState("");
  const [highValueVerified, setHighValueVerified] = useState(false);
  const [highValueVerifying, setHighValueVerifying] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);
  const [usdMode, setUsdMode] = useState(false);
  const [usdStr, setUsdStr] = useState("");
  const [sending, setSending] = useState(false);

  const accountName = vault?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const vaultAccountTargets = (vault?.accounts ?? [])
    .filter((a) => !a.hidden)
    .map((a) => ({ name: a.name, identity: a.identity ?? wallets[a.index]?.identity ?? "", note: a.note, tags: a.tags }))
    .filter((a) => a.identity && a.identity !== identity);
  const canOpenPicker = contacts.length > 0 || vaultAccountTargets.length > 0;

  const { data: recentTxsData } = useTxHistory(identity || null);
  const recentTxs = recentTxsData?.pages[0];

  const destUpper = destination.trim().toUpperCase();
  const matchedContact = contacts.find((c) => c.identity === destUpper);
  const destIsKnownContact = !!matchedContact;
  const amountValue = (() => { try { return BigInt(amountStr.trim() || "0"); } catch { return 0n; } })();
  const needsHighValueConfirmation = exceedsHighValueThreshold(amountValue, settings.highValueSendThreshold);
  const recentRecipientIdentities = useMemo(() => getRecentRecipientIdentities(identity || null, recentTxs), [identity, recentTxs]);
  const suggestions = useMemo(
    () => buildAddressSuggestions({ query: destination, contacts, accounts: vaultAccountTargets, currentIdentity: identity, recentIdentities: recentRecipientIdentities }),
    [contacts, destination, identity, recentRecipientIdentities, vaultAccountTargets],
  );

  const price = stats?.price;
  const usdEquiv = price && amountStr ? Number(amountStr) * price : null;

  // Sync from URL
  const prevSearchRef = useRef(searchParams.toString());
  const destRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const current = searchParams.toString();
    if (current === prevSearchRef.current) return;
    prevSearchRef.current = current;
    if (step !== "input") return;
    const to = searchParams.get("to");
    const amount = searchParams.get("amount");
    if (to) setDestination(to.toUpperCase());
    if (amount) setAmountStr(amount);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore draft
  useEffect(() => {
    if (draftRestored || !txDraft) return;
    const age = Date.now() - txDraft.savedAt;
    if (age < 30 * 60 * 1000) { setDestination(txDraft.destination); setAmountStr(txDraft.amountStr); }
    setDraftRestored(true);
    clearTxDraft();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for confirmation (always active after send)
  useEffect(() => {
    if (!txHash || watchResult !== "pending") return;
    const found = recentTxs?.find((t) => t.hash === txHash);
    if (found) { setWatchResult(found.moneyFlew === false ? "failed" : "confirmed"); return; }
    if (tickInfo?.tick && savedTargetTick && tickInfo.tick > savedTargetTick + 30) setWatchResult("failed");
  }, [txHash, recentTxs, tickInfo, savedTargetTick, watchResult]);

  // Numpad handler
  const handleNumpad = useCallback((key: string) => {
    setAmountError("");
    if (usdMode) {
      if (key === "⌫") {
        setUsdStr((prev) => prev.slice(0, -1));
        if (price) {
          const newStr = usdStr.slice(0, -1);
          const n = parseFloat(newStr);
          setAmountStr(!isNaN(n) && n > 0 ? Math.round(n / price).toString() : "");
        }
      } else {
        const next = usdStr + key;
        if (price) {
          const n = parseFloat(next);
          const quAmount = !isNaN(n) && n > 0 ? Math.round(n / price) : 0;
          if (balance !== null && BigInt(quAmount) > balance) return; // cap at balance
          setAmountStr(quAmount > 0 ? quAmount.toString() : "");
        }
        setUsdStr(next);
      }
    } else {
      if (key === "⌫") {
        setAmountStr((prev) => prev.slice(0, -1));
      } else {
        setAmountStr((prev) => {
          if (prev === "0" && key !== "0") return key;
          if (prev === "0" && key === "0") return prev;
          const next = prev + key;
          if (balance !== null) {
            try { if (BigInt(next) > balance) return prev; } catch { return prev; }
          }
          return next;
        });
      }
    }
  }, [usdMode, price, usdStr, balance]);

  // Keyboard support
  useEffect(() => {
    if (step !== "input") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleNumpad(e.key);
      else if (e.key === "Backspace") handleNumpad("⌫");
      else if (e.key === "Enter") goReview();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function validateInputs(): boolean {
    let ok = true;
    if (!wallet) { setDestError(watchOnly ? "Watch-only account" : "Account locked"); destRef.current?.focus(); return false; }
    if (!isValidIdentity(destUpper)) { setDestError("Invalid identity"); destRef.current?.focus(); ok = false; } else setDestError("");
    const amount = amountStr.trim();
    if (!amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) { setAmountError("Enter an amount"); ok = false; }
    else if (balance !== null && BigInt(amount) > balance) { setAmountError("Insufficient balance"); ok = false; }
    else setAmountError("");
    return ok;
  }

  async function verifyHighValue() {
    if (!vault?.encryptedData || !highValuePassword) return;
    setHighValueVerifying(true); setHighValuePasswordError("");
    try { await unlockVault(vault.encryptedData, highValuePassword); setHighValueVerified(true); setHighValuePassword(""); }
    catch { setHighValuePasswordError("Wrong password"); }
    finally { setHighValueVerifying(false); }
  }

  function goReview() { if (validateInputs()) { setHighValueVerified(false); setHighValuePassword(""); setHighValuePasswordError(""); setStep("review"); } }

  async function send() {
    if (!wallet) return;
    setSending(true);
    setStep("sending");
    try {
      const amount = BigInt(amountStr.trim());
      const currentTick = await getLatestTick();
      const targetTick = estimateTargetTick(currentTick, settings.tickOffset);
      const { encoded, hash } = await buildTransferFromSession({ accountIndex: settings.activeAccountIndex, destination: destUpper, amount, targetTick, currentTick });
      await broadcastTx(encoded);
      addPendingTx({ hash, source: identity, destination: destUpper, amount: amount.toString(), targetTick, broadcastAt: Date.now() });
      if (matchedContact) updateContact(matchedContact.id, { lastUsedAt: Date.now() });
      setSavedTargetTick(targetTick); setTxHash(hash); setWatchResult("pending"); setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      saveTxDraft({ destination: destUpper, amountStr, savedAt: Date.now() });
      setStep("error");
    }
  }

  function doSaveContact() {
    if (!saveName.trim()) return;
    addContact({ id: newId(), name: saveName.trim(), identity: destUpper, note: "", addedAt: Date.now(), lastUsedAt: Date.now() });
    setSaved(true);
  }

  // ── Input step (numpad layout) ───────────────────────────────────────────

  if (step === "input") {
    const header = (
      <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
        <button type="button" onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2) 0", display: "flex", alignItems: "center" }}>
          <AltArrowLeft size={20} />
        </button>
        <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
          Send from {accountName}
        </span>
      </div>
    );

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "hidden" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

        {/* Amount display */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "var(--space-8)", paddingBottom: "var(--space-2)", gap: "var(--space-1)", position: "relative", overflow: "hidden", width: "100%" }}>

          {/* Draft notice */}
          {draftRestored && (
            <div style={{ position: "absolute", top: "var(--space-3)", padding: "var(--space-1) var(--space-3)", background: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius-pill)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ ...labelStyle, color: "var(--color-status-warning)", fontSize: "var(--text-label)" }}>Draft restored</span>
              <button type="button" onClick={() => setDraftRestored(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-status-warning)", fontSize: "0.625rem", padding: 0 }}>✕</button>
            </div>
          )}

          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: (() => {
              const raw = usdMode ? usdStr : amountStr;
              if (!raw) return "var(--text-display)";
              const len = raw.length + (usdMode ? 1 : 0); // +1 for $
              if (len <= 6) return "3.5rem";
              if (len <= 9) return "2.75rem";
              if (len <= 12) return "2.125rem";
              return "1.75rem";
            })(),
            fontWeight: 700,
            color: amountError ? "var(--color-status-error)" : (usdMode ? usdStr : amountStr) ? "var(--color-text-display)" : "var(--color-text-disabled)",
            letterSpacing: "-0.03em", lineHeight: 1.1, minHeight: "3.5rem",
            transition: "color 0.15s, font-size 0.15s",
          }}>
            {usdMode
              ? (usdStr ? `$${Number(usdStr).toLocaleString()}` : "$0")
              : (amountStr ? Number(amountStr).toLocaleString() : "0")
            }
          </span>

          <button
            type="button"
            onClick={() => {
              if (!usdMode && price && amountStr) {
                setUsdStr((Number(amountStr) * price).toFixed(2));
              }
              if (usdMode && price && usdStr) {
                const n = parseFloat(usdStr);
                if (!isNaN(n) && n > 0) setAmountStr(Math.round(n / price).toString());
              }
              setUsdMode((v) => !v);
            }}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: 0 }}
          >
            {usdMode
              ? (amountStr ? `≈ ${Number(amountStr).toLocaleString()} QU` : "QU")
              : (usdEquiv !== null && usdEquiv > 0 ? `≈ $${usdEquiv.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "USD")
            }
          </button>

          {amountError && (
            <span style={{ ...labelStyle, color: "var(--color-status-error)", fontSize: "var(--text-label)" }}>{amountError}</span>
          )}
        </div>

        {/* Recipient */}
        <div style={{ flex: "0 0 auto", position: "relative" }}>
          <div style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4) var(--space-4)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2), 0 0 1px rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <UserId size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
              <input
                ref={destRef}
                autoComplete="off"
                value={destination}
                onChange={(e) => { setDestination(e.target.value); setDestError(""); }}
                placeholder="Enter identity or contact"
                onFocus={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--color-text-secondary)"; }}
                onBlur={(e) => { e.currentTarget.parentElement!.style.borderColor = "transparent"; }}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                  color: "var(--color-text-display)", padding: 0, minWidth: 0,
                }}
              />
              {canOpenPicker && (
                <button onClick={() => setShowPicker(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4, color: "var(--color-text-disabled)", display: "flex" }}>
                  <QrCode size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions overlay */}
          {destination.trim() && suggestions.filter((s) => s.identity !== destUpper).length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 8, right: 8, zIndex: 50,
              marginTop: "var(--space-1)", paddingTop: "var(--space-2)", paddingBottom: "var(--space-2)",
              background: "var(--color-bg-elevated)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              maxHeight: 240, overflowY: "auto",
              animation: "slide-down 0.15s ease-out",
            }}>
              <AddressSuggestions
                suggestions={suggestions.filter((s) => s.identity !== destUpper)}
                onSelect={(id) => { setDestination(id); setDestError(""); }}
              />
            </div>
          )}
          {!destError && matchedContact && (
            <span style={{ ...labelStyle, color: "var(--color-accent)", fontSize: "var(--text-label)", paddingLeft: "var(--space-1)", marginTop: "var(--space-1)", display: "block" }}>{matchedContact.name}</span>
          )}
          {destError && (
            <span style={{ ...labelStyle, color: "var(--color-status-error)", fontSize: "var(--text-label)", paddingLeft: "var(--space-1)", marginTop: "var(--space-1)", display: "block" }}>{destError}</span>
          )}
        </div>

        {/* Available balance */}
        {balance !== null && (
          <div style={{ flex: "0 0 auto", textAlign: "center", paddingBottom: "var(--space-1)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
              {formatQu(balance)} available
            </span>
          </div>
        )}

        {/* Numpad */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingTop: 0 }}>
          <Numpad onPress={handleNumpad} onMax={balance !== null ? () => { setAmountStr(balance.toString()); setAmountError(""); if (price) setUsdStr((Number(balance) * price).toFixed(2)); } : undefined} />
        </div>

        {/* Actions */}
        <div style={{ flex: "0 0 auto", padding: "var(--space-3) 0 var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button onClick={goReview} disabled={!wallet}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              Review <ArrowRightUp size={16} weight="Bold" />
            </span>
          </Button>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--space-3)" }}>
            <motion.button {...gesture.pressSubtle} onClick={() => navigate("/send-many")}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--color-text-disabled)", padding: 0, fontSize: "var(--text-label)" }}>
              Send to many
            </motion.button>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--color-text-disabled)", opacity: 0.5, flexShrink: 0 }} />
            <motion.button {...gesture.pressSubtle} onClick={() => navigate("/burn")}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--color-text-disabled)", padding: 0, fontSize: "var(--text-label)" }}>
              Burn QU
            </motion.button>
          </div>
        </div>

        <ContactPicker
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(id) => { setDestination(id); setDestError(""); setShowPicker(false); }}
          contacts={contacts}
          accounts={vaultAccountTargets}
        />
        </motion.div>
      </AppShell>
    );
  }

  // ── Review step ──────────────────────────────────────────────────────────

  const header = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => step === "review" ? setStep("input") : navigate("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2) 0", display: "flex", alignItems: "center" }}>
        <AltArrowLeft size={20} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
        {step === "review" ? "Review" : step === "done" ? "Sent" : step === "sending" ? "Sending" : "Error"}
      </span>
    </div>
  );

  if (step === "review") {
    const cardStyle: React.CSSProperties = {
      background: "var(--color-bg-surface)",
      borderRadius: "var(--radius-card)",
      padding: "var(--space-1) var(--space-4)",
      animation: "fade-in-up 0.25s ease-out both",
    };
    const divider: React.CSSProperties = {
      height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))",
    };
    const targetTick = tickInfo ? String(estimateTargetTick(tickInfo.tick ?? 0, settings.tickOffset)) : "—";

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        {/* Amount */}
        <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {formatQu(amountStr)}
          </div>
          {price && amountStr && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
              ≈ ${(Number(amountStr) * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "var(--color-border-subtle)", opacity: 0.5, margin: "var(--space-1) 0" }} />

        {/* Parties card */}
        <div style={cardStyle}>
          <DetailRow
            icon={<UserId size={16} />}
            label="To"
            value={matchedContact ? matchedContact.name : truncateId(destUpper)}
            mono={!matchedContact}
            valueColor={matchedContact ? "var(--color-accent)" : undefined}
          />
          <div style={divider} />
          <DetailRow
            icon={<Wallet size={16} />}
            label="From"
            value={`${accountName} · ${truncateId(identity)}`}
            mono={false}
          />
        </div>

        {/* Details card */}
        <div style={cardStyle}>
          <DetailRow
            icon={<ClockCircle size={16} />}
            label="Target tick"
            value={targetTick}
          />
          <div style={divider} />
          <DetailRow
            icon={<Bolt size={16} />}
            label="Fee"
            value="None"
            mono={false}
          />
        </div>

        {/* Pending warning */}
        {hasPendingTx && (
          <div style={{ background: "rgba(245, 158, 11, 0.08)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <ClockCircle size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Transfer pending — wait for confirmation</span>
          </div>
        )}

        {/* High value confirmation */}
        {needsHighValueConfirmation && !highValueVerified && (
          <div style={{ background: "rgba(245, 158, 11, 0.06)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>High-value transfer — confirm with vault password</span>
            <Input type="password" label="Vault password" value={highValuePassword}
              onChange={(e) => { setHighValuePassword(e.target.value); setHighValuePasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && !highValueVerifying && verifyHighValue()}
              error={highValuePasswordError} placeholder="••••••••••" autoComplete="current-password" />
            <Button variant="secondary" onClick={verifyHighValue} loading={highValueVerifying} disabled={!highValuePassword}>Confirm</Button>
          </div>
        )}
        {needsHighValueConfirmation && highValueVerified && (
          <div style={{ ...labelStyle, color: "var(--color-accent)", textAlign: "center" }}>High-value transfer confirmed ✓</div>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button onClick={send} loading={sending} disabled={!wallet || !tickInfo || hasPendingTx || (needsHighValueConfirmation && !highValueVerified)}>Sign and send</Button>
          <motion.button {...gesture.pressSubtle} type="button" onClick={() => setStep("input")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
            Edit
          </motion.button>
        </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  if (step === "sending") {
    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-5)" }}>
        <div style={{
          width: 48, height: 48, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            position: "absolute", inset: 0,
            border: "3px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)",
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }} />
          <ArrowRightUp size={18} style={{ color: "var(--color-accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Broadcasting</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
            {formatQu(amountStr)} to {matchedContact?.name ?? truncateId(destUpper)}
          </div>
        </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (step === "done") {
    const cardStyle: React.CSSProperties = {
      background: "var(--color-bg-surface)",
      borderRadius: "var(--radius-card)",
      padding: "var(--space-1) var(--space-4)",
    };
    const divider: React.CSSProperties = {
      height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))",
    };

    const statusColor = watchResult === "confirmed" ? "var(--color-accent)" : watchResult === "failed" ? "var(--color-status-error)" : "var(--color-text-disabled)";

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Amount */}
        <div className="flash-success" style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <CheckCircle size={64} style={{ color: "var(--color-accent)" }} />
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "1.5rem", color: "var(--color-text-display)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Transaction sent
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-accent)", letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: "var(--space-2)" }}>
            {formatQu(amountStr)}
          </div>
        </div>

        {/* Details card */}
        <div style={cardStyle}>
          <DetailRow
            icon={<UserId size={16} />}
            label="To"
            value={matchedContact ? matchedContact.name : truncateId(destUpper)}
            mono={!matchedContact}
            valueColor={matchedContact ? "var(--color-accent)" : undefined}
          />
          <div style={divider} />
          <DetailRow icon={<Bolt size={16} />} label="Hash" value={truncateId(txHash)} />
          <div style={divider} />
          <DetailRow icon={<ClockCircle size={16} />} label="Tick" value={String(savedTargetTick)} valueColor="var(--color-text-secondary)" />
          <div style={divider} />
          <DetailRow
            icon={watchResult === "confirmed" ? <ShieldCheck size={16} style={{ color: "var(--color-accent)" }} /> : watchResult === "failed" ? <ShieldWarning size={16} style={{ color: "var(--color-status-error)" }} /> : <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
            label="Status"
            value={watchResult === "confirmed" ? "Confirmed" : watchResult === "failed" ? "Failed" : "Watching…"}
            mono={false}
            valueColor={statusColor}
          />
        </div>

        {/* Save contact — card-based */}
        {!destIsKnownContact && !saved && (
          <div style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4) var(--space-4)",
            display: "flex", alignItems: "center", gap: "var(--space-3)",
          }}>
            <Bookmark size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
            <input autoComplete="off" value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSaveContact()}
              placeholder="Save as contact"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                color: "var(--color-text-display)", padding: 0, minWidth: 0,
              }}
            />
            <button type="button" onClick={doSaveContact} disabled={!saveName.trim()}
              style={{
                background: "none", border: "none", cursor: saveName.trim() ? "pointer" : "default",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                color: saveName.trim() ? "var(--color-accent)" : "var(--color-text-disabled)",
                padding: 0, flexShrink: 0,
              }}>
              Save
            </button>
          </div>
        )}
        {saved && (
          <div style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4) var(--space-4)",
            display: "flex", alignItems: "center", gap: "var(--space-3)",
          }}>
            <CheckCircle size={16} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-accent)" }}>Contact saved</span>
          </div>
        )}

        {/* Notes */}
        <TxMemoField hash={txHash} />

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button onClick={() => navigate("/dashboard")}>Done</Button>
          <motion.button {...gesture.pressSubtle} type="button" onClick={() => navigate("/history")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
            View history
          </motion.button>
        </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  return (
    <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "rgba(255, 59, 48, 0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ShieldWarning size={22} style={{ color: "var(--color-status-error)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Broadcast failed</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)", maxWidth: 280 }}>
          {txError || "The transaction could not be broadcast."}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 280, paddingTop: "var(--space-2)" }}>
        <Button onClick={() => setStep("review")}>Try again</Button>
        <motion.button {...gesture.pressSubtle} type="button" onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
          Cancel
        </motion.button>
      </div>
      </motion.div>
    </AppShell>
  );
}
