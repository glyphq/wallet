import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UserId, AddCircle, TrashBinMinimalistic, Clipboard, Document, ClockCircle, Bolt, Wallet, ArrowRightUp, ShieldCheck, ShieldWarning, CheckCircle } from "@solar-icons/react";
import { buildPayload, type PayloadField } from "@qubic.org/tx";
import type { Identity } from "@qubic.org/types";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { AddressSuggestions } from "@/components/address-suggestions";
import { EmbeddedInput } from "@/components/embedded-input";
import { TextButton } from "@/components/text-button";
import { Textarea } from "@/components/textarea";
import { TxMemoField } from "@/components/tx-memo-field";
import { Sheet } from "@/components/sheet";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";
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
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};


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
  const rpcIdentity = useRpcCacheIdentity("live");
  const { data: feeData } = useQuery({
    queryKey: qk.qutilSendManyFee(rpcIdentity),
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
  const [sending, setSending] = useState(false);
  const identityRefs = useRef<Map<number, HTMLInputElement>>(new Map());

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
    if (!ok) {
      const firstErr = updated.findIndex((r) => r.identityError || r.amountError);
      if (firstErr >= 0) identityRefs.current.get(firstErr)?.focus();
    }
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
    setSending(true);
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
    } finally {
      setSending(false);
    }
  }

  // ── Input step ─────────────────────────────────────────────────────────────

  if (step === "input") {
    const remaining = balance !== null && fee !== null
      ? balance - recipients.reduce((s, r) => s + (r.amount.trim() ? BigInt(r.amount.trim()) : 0n), 0n) - fee
      : null;
    const overBalance = remaining !== null && remaining < 0n;

    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Import links */}
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-4)" }}>
          <TextButton onClick={() => setImportOpen(true)} tone="muted">
            <Clipboard size={12} /> Paste list
          </TextButton>
          <TextButton onClick={openImportFile} tone="muted">
            <Document size={12} /> Import CSV
          </TextButton>
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
                padding: "var(--space-3) var(--space-4)",
                display: "flex", flexDirection: "column", gap: "var(--space-3)",
              }}>
                {/* Identity row */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <UserId size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
                  <EmbeddedInput
                    ref={(el) => { if (el) identityRefs.current.set(i, el); else identityRefs.current.delete(i); }}
                    autoComplete="off"
                    value={r.identity}
                    onChange={(e) => setField(i, { identity: e.target.value, identityError: "" })}
                    onFocus={() => setFocusIndex(i)}
                    onBlur={() => setTimeout(() => setFocusIndex(null), 150)}
                    onKeyDown={(e) => e.key === "Enter" && goReview()}
                    placeholder={recipients.length > 1 ? `Recipient ${i + 1}` : "Identity or contact"}
                    style={{ flex: 1 }}
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
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", flexShrink: 0, width: 20, textAlign: "center" }}>QU</span>
                  <EmbeddedInput
                    autoComplete="off"
                    value={r.amount}
                    onChange={(e) => setField(i, { amount: e.target.value.replace(/[^0-9]/g, ""), amountError: "" })}
                    onKeyDown={(e) => e.key === "Enter" && goReview()}
                    placeholder="Amount"
                    inputMode="numeric"
                    technical
                    style={{ flex: 1 }}
                  />
                  {price && r.amount && Number(r.amount) > 0 && (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", flexShrink: 0 }}>
                      ≈ ${(Number(r.amount) * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {/* Errors */}
                {(r.identityError || r.amountError) && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
                    {r.identityError || r.amountError}
                  </span>
                )}

                {/* Contact match */}
                {matchedContact && !r.identityError && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-accent)" }}>{matchedContact.name}</span>
                )}
              </div>

              {/* Suggestions overlay */}
              {showSuggestions && (
                <div style={{
                  position: "absolute", top: "100%", left: 8, right: 8, zIndex: 50,
                  marginTop: "var(--space-1)", paddingTop: "var(--space-2)", paddingBottom: "var(--space-2)",
                  background: "var(--color-bg-elevated)",
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-overlay)",
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
          <Button variant="secondary" size="md" onClick={addRecipient}>
            <AddCircle size={14} /> Add recipient ({recipients.length}/{MAX_RECIPIENTS})
          </Button>
        )}

        {/* Summary card */}
        <div style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-1) var(--space-4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
            <ArrowRightUp size={16} style={{ color: "var(--color-text-disabled)" }} />
            <span style={{ ...labelStyle, flex: 1 }}>Total</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-display)" }}>
                {totalAmount.toLocaleString()} QU
              </span>
              {price && totalAmount > 0 && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
                  ≈ ${(totalAmount * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>
          {fee !== null && (
            <>
              <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
              <DetailRow icon={<Bolt size={16} />} label="QUtil fee" value={`${Number(fee).toLocaleString()} QU`} mono={false} />
            </>
          )}
          {remaining !== null && (
            <>
              <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
                <Wallet size={16} style={{ color: "var(--color-text-disabled)" }} />
                <span style={{ ...labelStyle, flex: 1 }}>Remaining</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: overBalance ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
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

        {/* Import sheet */}
        <Sheet open={importOpen} onClose={() => { setImportOpen(false); setImportError(""); setImportText(""); }} title="Paste recipients">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
              CSV: identity, amount, label. JSON arrays with identity and amount.
            </div>
            <Textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
              rows={6}
              placeholder={"identity,amount,label\nABC...,1000,Treasury"}
              style={{ minHeight: 144 }}
            />
            {importError && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{importError}</span>
            )}
            <Button onClick={importFromText}>Import</Button>
          </div>
        </Sheet>

        {/* Contact picker sheet */}
        <Sheet open={pickerIndex !== null} onClose={() => setPickerIndex(null)} title="Pick recipient">
          {contacts.map((c) => (
            <button key={c.id} onClick={() => { setField(pickerIndex!, { identity: c.identity, identityError: "" }); setPickerIndex(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "var(--space-3) 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-display)" }}>{c.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{truncateId(c.identity)}</span>
            </button>
          ))}
          {vaultAccountTargets.map((a) => (
            <button key={a.identity} onClick={() => { setField(pickerIndex!, { identity: a.identity, identityError: "" }); setPickerIndex(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "var(--space-3) 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-display)" }}>{a.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{truncateId(a.identity)}</span>
            </button>
          ))}
        </Sheet>
        </motion.div>
      </AppShell>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-surface)",
    borderRadius: "var(--radius-card)",
    padding: "var(--space-1) var(--space-4)",

  };
  const divider: React.CSSProperties = {
    height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))",
  };

  if (step === "review") {
    const totalWithFee = fee !== null ? totalAmount + Number(fee) : totalAmount;

    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Amount */}
        <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {totalAmount.toLocaleString()} QU
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
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
                  <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: contact ? "var(--color-accent)" : "var(--color-text-display)" }}>
                    {contact ? contact.name : truncateId(id)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-display)", flexShrink: 0 }}>
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
          <div style={{ background: "var(--color-status-warning-soft)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <ClockCircle size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Transfer pending — wait for confirmation</span>
          </div>
        )}

        {/* High value confirmation */}
        {needsHighValueConfirmation && !highValueConfirmed && (
          <div style={{ background: "var(--color-status-warning-soft)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer", userSelect: "none" }}
            role="checkbox" aria-checked={highValueConfirmed} tabIndex={0}
            onClick={() => setHighValueConfirmed(true)}
            onKeyDown={(e) => e.key === "Enter" && setHighValueConfirmed(true)}>
            <ShieldWarning size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>High-value transfer — tap to confirm</span>
          </div>
        )}
        {needsHighValueConfirmation && highValueConfirmed && (
          <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <ShieldCheck size={16} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-accent)" }}>High-value transfer confirmed</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
          <Button onClick={send} loading={sending} disabled={!wallet || fee === null || hasPendingTx || (needsHighValueConfirmation && !highValueConfirmed)}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              Sign and send <ArrowRightUp size={16} weight="Bold" />
            </span>
          </Button>
          <motion.button {...gesture.pressSubtle} type="button" onClick={() => setStep("input")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
            Edit
          </motion.button>
        </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Sending ────────────────────────────────────────────────────────────────

  if (step === "sending") {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-5)" }}>
        <div style={{ width: 48, height: 48, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ position: "absolute", inset: 0, border: "3px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <ArrowRightUp size={18} style={{ color: "var(--color-accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Broadcasting</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
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
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}>

        {/* Amount */}
        <div className="flash-success" style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-accent)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {totalAmount.toLocaleString()} QU
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <CheckCircle size={14} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-accent)" }}>Sent to {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}</span>
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
          <motion.button {...gesture.pressSubtle} type="button" onClick={() => navigate("/history")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
            View history
          </motion.button>
        </div>
        </motion.div>
      </AppShell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-status-error-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        <motion.button {...gesture.pressSubtle} type="button" onClick={() => navigate("/send")}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>
          Cancel
        </motion.button>
      </div>
      </motion.div>
    </AppShell>
  );
}
