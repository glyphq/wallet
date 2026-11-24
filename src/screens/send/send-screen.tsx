import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { isValidIdentity, newId } from "@/lib/crypto";
import { broadcastTx } from "@/lib/broadcast";
import { subscribeTxResolution } from "@/lib/tx-resolution-events";
import { buildTransferFromSession } from "@/lib/secure-session";
import { verifyVaultPassword } from "@/lib/vault";
import { extractMessage, formatPreferredCurrencyFromQu } from "@/lib/format";
import { buildAddressSuggestions, getRecentRecipientIdentities } from "@/lib/address-intelligence";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { exceedsHighValueThreshold } from "@/lib/session-policies";
import { parseScannedSendPayload } from "@/lib/scan-payload";
import {
  hasPendingFromAccount, normalizeIdentity, resolveTargetTick, validateQuAmount,
  type SendStep, type WatchResult,
} from "./send-flow";
import {
  SendDoneStep, SendErrorStep, SendSendingStep,
} from "./send-result-steps";
import { SendHeader } from "./send-header";
import { SendInputStep } from "./send-input-step";
import { SendReviewStep } from "./send-review-step";
import { useSendNumpadInput } from "./use-send-numpad";
import { useSendPrefill } from "./use-send-prefill";

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
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);

  const wallet = wallets[settings.activeAccountIndex] ?? null;
  const { data: tickInfo } = useTickInfo();
  const identity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";
  const { data: balanceData } = useBalance(identity || null);
  const balance = balanceData?.balance ?? null;
  const { data: stats } = useLatestStats();
  const quote = usePreferredCurrencyQuote();

  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState(() => searchParams.get("to") ?? "");
  const [amountStr, setAmountStr] = useState(() => searchParams.get("amount") ?? "");
  const [destError, setDestError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [savedTargetTick, setSavedTargetTick] = useState(0);
  const [watchResult, setWatchResult] = useState<WatchResult>("pending");
  const [highValuePassword, setHighValuePassword] = useState("");
  const [highValuePasswordError, setHighValuePasswordError] = useState("");
  const [highValueVerified, setHighValueVerified] = useState(false);
  const [highValueVerifying, setHighValueVerifying] = useState(false);
  const [memo, setMemo] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showQrIntake, setShowQrIntake] = useState(false);
  const [qrIntakeError, setQrIntakeError] = useState("");
  const [usdMode, setUsdMode] = useState(false);
  const [usdStr, setUsdStr] = useState("");
  const [sending, setSending] = useState(false);
  const destRef = useRef<HTMLInputElement>(null);

  const { draftRestored, dismissDraft } = useSendPrefill({
    searchParams, step, draft: txDraft, clearDraft: clearTxDraft, setDestination, setAmountStr,
  });

  const accountName = vault?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;
  const hasPendingTx = hasPendingFromAccount(pendingTxs, identity);
  const vaultAccountTargets = (vault?.accounts ?? [])
    .filter((a) => !a.hidden)
    .map((a) => ({ name: a.name, identity: a.identity ?? wallets[a.index]?.identity ?? "", note: a.note, tags: a.tags }))
    .filter((a) => a.identity && a.identity !== identity);
  const canOpenPicker = contacts.length > 0 || vaultAccountTargets.length > 0;
  const sendHeader = useMemo(() => (
    <SendHeader
      onSendMany={() => navigate("/send-many")}
      onScanQr={() => { setQrIntakeError(""); setShowQrIntake(true); }}
      onBurn={() => navigate("/burn")}
    />
  ), [navigate]);

  const { data: recentTxsData } = useTxHistory(identity || null);
  const recentTxs = recentTxsData?.pages[0]?.items;

  const destUpper = normalizeIdentity(destination);
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
  const fiatEquiv = price && amountStr ? formatPreferredCurrencyFromQu(amountStr, { usdPrice: price, ...quote }).text : null;

  // Watch for confirmation (always active after send)
  useEffect(() => {
    if (!txHash) return;
    return subscribeTxResolution(txHash, (resolution) => {
      setWatchResult(resolution.status === "confirmed" ? "confirmed" : "failed");
    });
  }, [txHash]);

  const handleNumpad = useSendNumpadInput({
    active: step === "input", usdMode, price, usdStr,
    setUsdStr, setAmountStr, setAmountError, onEnter: goReview,
  });

  function validateInputs(): boolean {
    let ok = true;
    if (!wallet) { setDestError("Account locked"); destRef.current?.focus(); return false; }
    if (!isValidIdentity(destUpper)) { setDestError("Invalid identity"); destRef.current?.focus(); ok = false; } else setDestError("");
    const amountValidation = validateQuAmount(amountStr, {
      balance,
      invalidMessage: "Enter an amount",
      insufficientMessage: "Insufficient balance",
    });
    if (amountValidation.error) ok = false;
    setAmountError(amountValidation.error);
    return ok;
  }

  async function verifyHighValue() {
    if (!vault?.encryptedData || !highValuePassword) return;
    setHighValueVerifying(true); setHighValuePasswordError("");
    try { await verifyVaultPassword(vault.encryptedData, highValuePassword); setHighValueVerified(true); setHighValuePassword(""); }
    catch { setHighValuePasswordError("Wrong password"); }
    finally { setHighValueVerifying(false); }
  }

  function goReview() { if (validateInputs()) { setHighValueVerified(false); setHighValuePassword(""); setHighValuePasswordError(""); setStep("review"); } }

  function applyScannedPayload(raw: string) {
    const parsed = parseScannedSendPayload(raw);
    if (!parsed) {
      setQrIntakeError("Unsupported QR. Use a Glyph payment link or a Qubic identity.");
      return;
    }

    if (parsed.kind === "identity") {
      setDestination(parsed.identity);
    } else {
      setDestination(parsed.to);
      setAmountStr(parsed.amount ?? "");
      setUsdMode(false);
      setUsdStr("");
    }
    setDestError("");
    setAmountError("");
    setQrIntakeError("");
    setShowQrIntake(false);
  }

  function toggleCurrency() {
    if (!usdMode && price && amountStr) {
      setUsdStr((Number(amountStr) * price).toFixed(2));
    }
    if (usdMode && price && usdStr) {
      const n = parseFloat(usdStr);
      if (!isNaN(n) && n > 0) setAmountStr(Math.round(n / price).toString());
    }
    setUsdMode((v) => !v);
  }

  const handleMax = balance !== null
    ? () => { setAmountStr(balance.toString()); setAmountError(""); if (price) setUsdStr((Number(balance) * price).toFixed(2)); }
    : undefined;

  async function send() {
    if (!wallet) return;
    setSending(true);
    setStep("sending");
    try {
      const amount = BigInt(amountStr.trim());
      const { currentTick, targetTick } = await resolveTargetTick(settings.tickOffset);
      const { encoded, hash } = await buildTransferFromSession({ accountIndex: settings.activeAccountIndex, destination: destUpper, amount, targetTick, currentTick });
      await broadcastTx(encoded);
      addPendingTx({ hash, source: identity, destination: destUpper, amount: amount.toString(), targetTick, broadcastAt: Date.now() });
      if (matchedContact) updateContact(matchedContact.id, { lastUsedAt: Date.now() });
      setSavedTargetTick(targetTick); setTxHash(hash); setWatchResult("pending"); setStep("done");
      if (memo.trim()) setTxMemo(hash, memo.trim());
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      saveTxDraft({ destination: destUpper, amountStr, savedAt: Date.now() });
      setStep("error");
    } finally {
      setSending(false);
    }
  }

  function saveContact(name: string) {
    addContact({ id: newId(), name, identity: destUpper, note: "", addedAt: Date.now(), lastUsedAt: Date.now() });
  }

  if (step === "input") {
    return (
      <SendInputStep
        statusBar={sendHeader}
        accountName={accountName}
        draftRestored={draftRestored}
        onDismissDraft={dismissDraft}
        amountStr={amountStr}
        usdMode={usdMode}
        usdStr={usdStr}
        amountError={amountError}
        fiatEquiv={fiatEquiv}
        displayCurrency={quote.currency}
        onToggleCurrency={toggleCurrency}
        onNumpad={handleNumpad}
        onMax={handleMax}
        balance={balance}
        destination={destination}
        destUpper={destUpper}
        destError={destError}
        destRef={destRef}
        matchedContactName={matchedContact?.name ?? null}
        canOpenPicker={canOpenPicker}
        suggestions={suggestions}
        onChangeDestination={(value) => { setDestination(value); setDestError(""); }}
        onSelectDestination={(value) => { setDestination(value); setDestError(""); }}
        onPickerSelect={(value) => { setDestination(value); setDestError(""); setShowPicker(false); }}
        onReview={goReview}
        canReview={!!wallet}
        contacts={contacts}
        accounts={vaultAccountTargets}
        showPicker={showPicker}
        onOpenPicker={() => setShowPicker(true)}
        onClosePicker={() => setShowPicker(false)}
        showQrIntake={showQrIntake}
        qrIntakeError={qrIntakeError}
        onCloseQr={() => { setShowQrIntake(false); setQrIntakeError(""); }}
        onQrScan={applyScannedPayload}
      />
    );
  }

  if (step === "review") {
    return (
      <SendReviewStep
        amountStr={amountStr}
        fiatEquiv={fiatEquiv}
        price={price}
        matchedContactName={matchedContact?.name ?? null}
        destUpper={destUpper}
        accountName={accountName}
        identity={identity}
        balance={balance}
        tickInfo={tickInfo}
        tickOffset={settings.tickOffset}
        hasPendingTx={hasPendingTx}
        needsHighValueConfirmation={needsHighValueConfirmation}
        highValueVerified={highValueVerified}
        highValuePassword={highValuePassword}
        highValuePasswordError={highValuePasswordError}
        highValueVerifying={highValueVerifying}
        onHighValuePasswordChange={(value) => { setHighValuePassword(value); setHighValuePasswordError(""); }}
        onVerifyHighValue={verifyHighValue}
        memo={memo}
        onMemoChange={setMemo}
        sending={sending}
        canSign={!!wallet && !!tickInfo}
        onSend={send}
        onEdit={() => setStep("input")}
      />
    );
  }

  if (step === "sending") {
    return (
      <SendSendingStep amountStr={amountStr} matchedContactName={matchedContact?.name ?? null} destUpper={destUpper} />
    );
  }

  if (step === "done") {
    return (
      <SendDoneStep
        amountStr={amountStr}
        matchedContactName={matchedContact?.name ?? null}
        destUpper={destUpper}
        txHash={txHash}
        savedTargetTick={savedTargetTick}
        currentTick={tickInfo?.tick ?? 0}
        watchResult={watchResult}
        destIsKnownContact={destIsKnownContact}
        onSaveContact={saveContact}
      />
    );
  }

  return (
    <SendErrorStep txError={txError} onRetry={() => setStep("review")} />
  );
}
