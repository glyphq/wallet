import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AltArrowLeft, UserId, AddCircle, TrashBinMinimalistic, Clipboard, Document, ClockCircle, Bolt, Wallet, ArrowRightUp, ShieldCheck, ShieldWarning, CheckCircle } from "@solar-icons/react";
import { buildPayload, type PayloadField } from "@qubic.org/tx";
import type { Identity } from "@qubic.org/types";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { AddressSuggestions } from "@/components/address-suggestions";
import { TxMemoField } from "@/components/tx-memo-field";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useTxHistory } from "@/hooks/use-tx-history";
import { isValidIdentity, newId } from "@/lib/crypto";
import { getRpcClient, estimateTargetTick, getLatestTick } from "@/lib/rpc";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { QUTIL_ADDRESS, Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE, qUtilGetSendToManyV1Fee } from "@/lib/contracts";
import { truncateId, formatQu, extractMessage } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { buildAddressSuggestions, getRecentRecipientIdentities } from "@/lib/address-intelligence";
import { getVaultAccountIdentity, isWatchOnlyVault } from "@/lib/accounts";
import { parseRecipientImport } from "@/lib/recipient-import";
import { exceedsHighValueThreshold } from "@/lib/session-policies";

const MAX_RECIPIENTS = 25;

interface Recipient {
  id: string;
  identity: string;
  amount: string;
  identityError: string;
  amountError: string;
}

type Step = "input" | "review" | "sending" | "done" | "error";

function emptyRecipient(): Recipient {
  return { id: newId(), identity: "", amount: "", identityError: "", amountError: "" };
}

// ── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

const stepMotion = {
  initial: { y: 4 },
  animate: { y: 0 },
  exit: { y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
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
        fontSize: "0.8125rem", fontWeight: useMono ? 400 : 500,
        color: valueColor ?? "var(--color-text-display)",
        textAlign: "right", maxWidth: "55%", wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SendManyScreen() {
  const navigate = useNavigate();

  const contacts = usePersistedStore((s) => s.contacts);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const settings = usePersistedStore((s) => s.settings);
  const wallets = useSessionStore((s) => s.wallets);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const wallet = wallets[settings.activeAccountIndex] ?? null;
  const identity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";
  const watchOnly = isWatchOnlyVault(vault);
  const { data: feeData } = useQuery({
    queryKey: qk.qutilSendManyFee(),
    queryFn: () => qUtilGetSendToManyV1Fee(getRpcClient().live),
    staleTime: 60_000,
  });
  const fee = feeData?.ok ? feeData.value.fee : null;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);
  const { data: balanceData } = useBalance(identity || null);
  const balance = balanceData?.balance ?? null;
  const { data: stats } = useLatestStats();
  const price = stats?.price;
  const { data: recentTxsData } = useTxHistory(identity || null);
  const recentTxs = recentTxsData?.pages[0];

  const [step, setStep] = useState<Step>("input");
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient()]);
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [formError, setFormError] = useState("");
  const [watchResult, setWatchResult] = useState<"pending" | "confirmed" | "failed">("pending");
  const [savedTargetTick, setSavedTargetTick] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const accountName = vault?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;

  const vaultAccountTargets = (vault?.accounts ?? [])
    .filter((a) => !a.hidden)
    .map((a) => ({ name: a.name, identity: a.identity ?? wallets[a.index]?.identity ?? "", note: a.note, tags: a.tags }))
    .filter((a) => a.identity && a.identity !== identity);
  const canOpenPicker = contacts.length > 0 || vaultAccountTargets.length > 0;
  const recentRecipientIdentities = useMemo(() => getRecentRecipientIdentities(identity || null, recentTxs), [identity, recentTxs]);

  function setField(index: number, field: Partial<Recipient>) {
    setRecipients((prev) => prev.map((r, i) => (i === index ? { ...r, ...field } : r)));
  }

  const suggestionsByIndex = useMemo(
    () => recipients.map((r) => buildAddressSuggestions({
      query: r.identity, contacts, accounts: vaultAccountTargets,
      currentIdentity: identity, recentIdentities: recentRecipientIdentities,
    })),
    [contacts, identity, recentRecipientIdentities, recipients, vaultAccountTargets],
  );

  function addRecipient() {
    if (recipients.length < MAX_RECIPIENTS) setRecipients((prev) => [...prev, emptyRecipient()]);
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function validateAll(): boolean {
    let ok = true;
    if (!wallet) { setFormError(watchOnly ? "Watch-only account" : "Account locked"); return false; }
    const updated = recipients.map((r) => {
      const identityError = isValidIdentity(r.identity.trim().toUpperCase()) ? "" : "Invalid identity";
      const amount = Number(r.amount.trim());
      const amountError = r.amount.trim() && Number.isInteger(amount) && amount > 0 ? "" : "Invalid amount";
      if (identityError || amountError) ok = false;
      return { ...r, identityError, amountError };
    });
    let nextFormError = "";
    if (ok && balance !== null && fee !== null) {
      const deducted = recipients.reduce((s, r) => s + BigInt(r.amount.trim()), 0n) + fee;
      if (deducted > balance) { ok = false; nextFormError = "Insufficient balance"; }
    }
    setRecipients(updated);
    setFormError(nextFormError);
    return ok;
  }

  function goReview() {
    setFormError("");
    if (validateAll()) setStep("review");
  }

  function applyImportedRecipients(next: ReturnType<typeof parseRecipientImport>) {
    if (next.length === 0) { setImportError("No valid recipients found"); return; }
    setRecipients(next.slice(0, MAX_RECIPIENTS).map((r) => ({
      id: newId(), identity: r.identity, amount: r.amount, identityError: "", amountError: "",
    })));
    setImportOpen(false); setImportText(""); setImportError("");
  }

  function importFromText() { applyImportedRecipients(parseRecipientImport(importText)); }

  function openImportFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.json,text/csv,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      applyImportedRecipients(parseRecipientImport(await file.text()));
    };
    input.click();
  }

  const totalAmount = recipients.reduce((sum, r) => {
    const n = Number(r.amount.trim());
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const totalAmountBigInt = recipients.reduce((sum, r) => {
    const n = Number(r.amount.trim());
    return sum + (Number.isInteger(n) && n > 0 ? BigInt(n) : 0n);
  }, 0n);
  const needsHighValueConfirmation = exceedsHighValueThreshold(totalAmountBigInt, settings.highValueSendThreshold);
  const [highValueConfirmed, setHighValueConfirmed] = useState(false);

  async function send() {
    if (!wallet || fee === null) return;
    setStep("sending");
    try {
      const currentTick = await getLatestTick();
      const targetTick = estimateTargetTick(currentTick, settings.tickOffset);
      const fields: PayloadField[] = [];
      for (let i = 0; i < MAX_RECIPIENTS; i++) {
        if (i < recipients.length) fields.push({ type: "id", value: recipients[i].identity.trim().toUpperCase() as Identity });
        else fields.push({ type: "bytes", value: new Uint8Array(32) });
      }
      for (let i = 0; i < MAX_RECIPIENTS; i++) {
        if (i < recipients.length) fields.push({ type: "uint64", value: BigInt(recipients[i].amount.trim()) });
        else fields.push({ type: "uint64", value: 0n });
      }
      const payload = buildPayload(fields);
      const total = recipients.reduce((s, r) => s + BigInt(r.amount.trim()), 0n) + (fee ?? 0n);
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QUTIL_ADDRESS,
        inputType: Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
        payload, amount: total, targetTick, currentTick,
      });
      await broadcastTx(encoded);
      recipients.forEach((r) => {
        const id = r.identity.trim().toUpperCase();
        const contact = contacts.find((c) => c.identity === id);
        if (contact) updateContact(contact.id, { lastUsedAt: Date.now() });
      });
      addPendingTx({ hash, source: wallet.identity, destination: QUTIL_ADDRESS, amount: total.toString(), targetTick, broadcastAt: Date.now(), contractName: "QUtil · Send to Many" });
      setSavedTargetTick(targetTick); setTxHash(hash); setWatchResult("pending"); setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      setStep("error");
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  const header = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => step === "input" ? navigate("/send") : step === "review" ? setStep("input") : navigate("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "8px 0", display: "flex", alignItems: "center" }}>
        <AltArrowLeft size={20} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
        {step === "input" ? `Send to many · ${accountName}` : step === "review" ? "Review" : step === "done" ? "Sent" : step === "sending" ? "Sending" : "Error"}
      </span>
    </div>
  );

  // ── Input step ─────────────────────────────────────────────────────────────

  if (step === "input") {
    const remaining = balance !== null && fee !== null
      ? balance - recipients.reduce((s, r) => s + (r.amount.trim() ? BigInt(r.amount.trim()) : 0n), 0n) - fee
      : null;
    const overBalance = remaining !== null && remaining < 0n;

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Import links */}
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-4)" }}>
          <button onClick={() => setImportOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-text-disabled)", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <Clipboard size={12} /> Paste list
          </button>
          <button onClick={openImportFile} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-text-disabled)", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <Document size={12} /> Import CSV
          </button>
        </div>

        {/* Recipient rows */}
        {recipients.map((r, i) => {
          const idUpper = r.identity.trim().toUpperCase();
          const matchedContact = contacts.find((c) => c.identity === idUpper);
          const showSuggestions = focusIndex === i && r.identity.trim() && suggestionsByIndex[i].filter((s) => s.identity !== idUpper).length > 0;

          return (
            <div key={r.id} style={{ position: "relative" }}>
              <div style={{
                background: "var(--color-bg-surface)",
                borderRadius: "var(--radius-card)",
                padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: "var(--space-3)",
              }}>
                {/* Identity row */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <UserId size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
                  <input
                    autoComplete="off"
                    value={r.identity}
                    onChange={(e) => setField(i, { identity: e.target.value, identityError: "" })}
                    onFocus={() => setFocusIndex(i)}
                    onBlur={() => setTimeout(() => setFocusIndex(null), 150)}
                    placeholder={recipients.length > 1 ? `Recipient ${i + 1}` : "Identity or contact"}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontFamily: "var(--font-sans)", fontSize: "0.9375rem",
                      color: "var(--color-text-display)", padding: 0, minWidth: 0,
                    }}
                  />
                  {canOpenPicker && (
                    <button onClick={() => setPickerIndex(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4, color: "var(--color-text-disabled)", display: "flex" }}>
                      <UserId size={16} />
                    </button>
                  )}
                  {recipients.length > 1 && (
                    <button onClick={() => removeRecipient(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4, color: "var(--color-text-disabled)", display: "flex" }}>
                      <TrashBinMinimalistic size={16} />
                    </button>
                  )}
                </div>

                {/* Amount row */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", flexShrink: 0, width: 20, textAlign: "center" }}>QU</span>
                  <input
                    autoComplete="off"
                    value={r.amount}
                    onChange={(e) => setField(i, { amount: e.target.value.replace(/[^0-9]/g, ""), amountError: "" })}
                    placeholder="Amount"
                    inputMode="numeric"
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontFamily: "var(--font-mono)", fontSize: "0.9375rem",
                      color: "var(--color-text-display)", padding: 0, minWidth: 0,
                    }}
                  />
                  {price && r.amount && Number(r.amount) > 0 && (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--color-text-disabled)", flexShrink: 0 }}>
                      ≈ ${(Number(r.amount) * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {/* Errors */}
                {(r.identityError || r.amountError) && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--color-status-error)" }}>
                    {r.identityError || r.amountError}
                  </span>
                )}

                {/* Contact match */}
                {matchedContact && !r.identityError && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--color-accent)" }}>{matchedContact.name}</span>
                )}
              </div>

              {/* Suggestions overlay */}
              {showSuggestions && (
                <div style={{
                  position: "absolute", top: "100%", left: 8, right: 8, zIndex: 50,
                  marginTop: 4, paddingTop: "var(--space-2)", paddingBottom: "var(--space-2)",
                  background: "var(--color-bg-elevated)",
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  maxHeight: 200, overflowY: "auto",

                }}>
                  <AddressSuggestions
                    suggestions={suggestionsByIndex[i].filter((s) => s.identity !== idUpper)}
                    onSelect={(id) => { setField(i, { identity: id, identityError: "" }); setFocusIndex(null); }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add recipient */}
        {recipients.length < MAX_RECIPIENTS && (
          <button onClick={addRecipient} style={{
            background: "none", border: "1px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-card)", padding: "12px",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "var(--font-sans)", fontSize: "0.8125rem",
            color: "var(--color-text-disabled)", width: "100%",
          }}>
            <AddCircle size={14} /> Add recipient ({recipients.length}/{MAX_RECIPIENTS})
          </button>
        )}

        {/* Summary card */}
        <div style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-card)",
          padding: "4px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
            <ArrowRightUp size={16} style={{ color: "var(--color-text-disabled)" }} />
            <span style={{ ...labelStyle, flex: 1 }}>Total</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>
                {totalAmount.toLocaleString()} QU
              </span>
              {price && totalAmount > 0 && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--color-text-disabled)" }}>
                  ≈ ${(totalAmount * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>
          {fee !== null && (
            <>
              <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 -16px" }} />
              <DetailRow icon={<Bolt size={16} />} label="QUtil fee" value={`${Number(fee).toLocaleString()} QU`} mono={false} />
            </>
          )}
          {remaining !== null && (
            <>
              <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 -16px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
                <Wallet size={16} style={{ color: "var(--color-text-disabled)" }} />
                <span style={{ ...labelStyle, flex: 1 }}>Remaining</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: overBalance ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
                  {formatQu(remaining < 0n ? 0n : remaining)} QU
                </span>
              </div>
            </>
          )}
        </div>

        {watchOnly && (
          <span style={{ ...labelStyle, color: "var(--color-status-warning)", textAlign: "center" }}>Watch-only account — send to many is disabled</span>
        )}
        {formError && (
          <span style={{ ...labelStyle, color: "var(--color-status-error)", textAlign: "center" }}>{formError}</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ paddingBottom: "var(--space-6)" }}>
          <Button onClick={goReview} disabled={recipients.length === 0 || !wallet || watchOnly}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              Review <ArrowRightUp size={16} weight="Bold" />
            </span>
          </Button>
        </div>

        {/* Import modal */}
        {importOpen && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "var(--space-4)",
          }} onClick={() => { setImportOpen(false); setImportError(""); setImportText(""); }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: "var(--color-bg-elevated)",
              borderRadius: "var(--radius-card)",
              padding: "var(--space-6)",
              width: "100%", maxWidth: 400,
              display: "flex", flexDirection: "column", gap: "var(--space-4)",
            }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)" }}>Paste recipients</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-text-disabled)", marginTop: 4 }}>
                  CSV: identity, amount, label. JSON arrays with identity and amount.
                </div>
              </div>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
                rows={6}
                placeholder={"identity,amount,label\nABC...,1000,Treasury"}
                style={{
                  width: "100%", resize: "vertical",
                  background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-card)", padding: "var(--space-3)",
                  fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              {importError && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-status-error)" }}>{importError}</span>
              )}
              <Button onClick={importFromText}>Import</Button>
              <button type="button" onClick={() => { setImportOpen(false); setImportError(""); setImportText(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", padding: "8px 0", alignSelf: "center" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contact picker */}
        {pickerIndex !== null && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end",
          }} onClick={() => setPickerIndex(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: "var(--color-bg-elevated)",
              borderRadius: "var(--radius-card) var(--radius-card) 0 0",
              padding: "var(--space-6)", width: "100%", maxHeight: "70vh", overflowY: "auto",
            }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-4)" }}>
                Pick recipient
              </div>
              {contacts.map((c) => (
                <button key={c.id} onClick={() => { setField(pickerIndex, { identity: c.identity, identityError: "" }); setPickerIndex(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>{c.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-disabled)" }}>{truncateId(c.identity)}</span>
                </button>
              ))}
              {vaultAccountTargets.map((a) => (
                <button key={a.identity} onClick={() => { setField(pickerIndex, { identity: a.identity, identityError: "" }); setPickerIndex(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-display)" }}>{a.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-disabled)" }}>{truncateId(a.identity)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        </motion.div>
      </AppShell>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-surface)",
    borderRadius: "var(--radius-card)",
    padding: "4px 16px",

  };
  const divider: React.CSSProperties = {
    height: 1, background: "var(--color-border-subtle)", margin: "0 -16px",
  };

  if (step === "review") {
    const totalWithFee = fee !== null ? totalAmount + Number(fee) : totalAmount;

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Amount */}
        <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "2.5rem", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {totalAmount.toLocaleString()} QU
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", marginTop: 4 }}>
            {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Recipients card */}
        <div style={cardStyle}>
          {recipients.map((r, i) => {
            const id = r.identity.trim().toUpperCase();
            const contact = contacts.find((c) => c.identity === id);
            return (
              <div key={r.id}>
                {i > 0 && <div style={divider} />}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
                  <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><UserId size={16} /></span>
                  <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: contact ? "var(--color-accent)" : "var(--color-text-display)" }}>
                    {contact ? contact.name : truncateId(id)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-display)", flexShrink: 0 }}>
                    {Number(r.amount).toLocaleString()} QU
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals card */}
        <div style={cardStyle}>
          <DetailRow icon={<ArrowRightUp size={16} />} label="Transfers" value={`${totalAmount.toLocaleString()} QU`} />
          <div style={divider} />
          <DetailRow icon={<Bolt size={16} />} label="QUtil fee" value={fee !== null ? `${Number(fee).toLocaleString()} QU` : "Loading…"} mono={false} />
          <div style={divider} />
          <DetailRow icon={<Wallet size={16} />} label="Total" value={`${totalWithFee.toLocaleString()} QU`} mono={false} valueColor="var(--color-text-display)" />
        </div>

        {/* Pending warning */}
        {hasPendingTx && (
          <div style={{ background: "rgba(245, 158, 11, 0.08)", borderRadius: "var(--radius-card)", padding: "12px 16px", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <ClockCircle size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Transfer pending — wait for confirmation</span>
          </div>
        )}

        {/* High value confirmation */}
        {needsHighValueConfirmation && !highValueConfirmed && (
          <div style={{ background: "rgba(245, 158, 11, 0.06)", borderRadius: "var(--radius-card)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer", userSelect: "none" }}
            role="checkbox" aria-checked={highValueConfirmed} tabIndex={0}
            onClick={() => setHighValueConfirmed(true)}
            onKeyDown={(e) => e.key === "Enter" && setHighValueConfirmed(true)}>
            <ShieldWarning size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>High-value transfer — tap to confirm</span>
          </div>
        )}
        {needsHighValueConfirmation && highValueConfirmed && (
          <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <ShieldCheck size={16} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-accent)" }}>High-value transfer confirmed</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button onClick={send} disabled={!wallet || fee === null || hasPendingTx || (needsHighValueConfirmation && !highValueConfirmed)}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              Sign and send <ArrowRightUp size={16} weight="Bold" />
            </span>
          </Button>
          <button type="button" onClick={() => setStep("input")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", padding: "8px 0", alignSelf: "center" }}>
            Edit
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
          <ArrowRightUp size={18} style={{ color: "var(--color-accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)" }}>Broadcasting</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", marginTop: 4 }}>
            {totalAmount.toLocaleString()} QU to {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
          </div>
        </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (step === "done") {
    const statusColor = watchResult === "confirmed" ? "var(--color-accent)" : watchResult === "failed" ? "var(--color-status-error)" : "var(--color-text-disabled)";

    return (
      <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Amount */}
        <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "2.5rem", color: "var(--color-accent)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {totalAmount.toLocaleString()} QU
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <CheckCircle size={14} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-accent)" }}>Sent to {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Details card */}
        <div style={cardStyle}>
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

        <TxMemoField hash={txHash} />

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button onClick={() => navigate("/dashboard")}>Done</Button>
          <button type="button" onClick={() => navigate("/history")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", padding: "8px 0", alignSelf: "center" }}>
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
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-display)" }}>Broadcast failed</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", marginTop: 4, maxWidth: 280 }}>
          {txError || "The transaction could not be broadcast."}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 280, paddingTop: "var(--space-2)" }}>
        <Button onClick={() => setStep("review")}>Try again</Button>
        <button type="button" onClick={() => navigate("/send")}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-text-disabled)", padding: "8px 0", alignSelf: "center" }}>
          Cancel
        </button>
      </div>
      </motion.div>
    </AppShell>
  );
}
