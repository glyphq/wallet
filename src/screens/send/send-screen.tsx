import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { isValidIdentity } from "@/lib/crypto";
import { broadcastTx } from "@/lib/broadcast";
import { buildTransferFromSession } from "@/lib/secure-session";
import { verifyWalletPassword } from "@/lib/wallet";
import { extractMessage, formatPreferredCurrencyFromQu } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { exceedsHighValueThreshold } from "@/lib/session-policies";
import { fiatInputToQubic, fiatPerQubic, qubicToFiatInput } from "@/lib/amount-currency";
import {
  hasPendingFromAccount, normalizeIdentity, resolveTargetTick, validateQuAmount,
  type SendStep,
} from "./send-flow";
import { SendErrorStep } from "./send-result-steps";
import { SendHeader } from "./send-header";
import { SendInputStep } from "./send-input-step";
import { SendReviewStep } from "./send-review-step";
import { useSendPrefill } from "./use-send-prefill";

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SendScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const settings = usePersistedStore((s) => s.settings);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));
  const contacts = usePersistedStore((s) => s.contacts);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const accounts = useSessionStore((s) => s.accounts);
  const txDraft = useSessionStore((s) => s.txDraft);
  const saveTxDraft = useSessionStore((s) => s.saveTxDraft);
  const clearTxDraft = useSessionStore((s) => s.clearTxDraft);
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);

  const account = accounts[settings.activeAccountIndex] ?? null;
  const { data: tickInfo } = useTickInfo();
  const identity = getWalletAccountIdentity(wallet ?? null, settings.activeAccountIndex, accounts) ?? "";
  const { data: balanceData } = useBalance(identity || null);
  const balance = balanceData?.balance ?? null;
  const { data: stats } = useLatestStats();
  const quote = usePreferredCurrencyQuote();

  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState(() => searchParams.get("to") ?? "");
  const [amountStr, setAmountStr] = useState(() => searchParams.get("amount") ?? "");
  const [amountUnit, setAmountUnit] = useState<"qubic" | "fiat">("qubic");
  const [fiatInput, setFiatInput] = useState("");
  const [destError, setDestError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [txError, setTxError] = useState("");
  const [highValuePassword, setHighValuePassword] = useState("");
  const [highValuePasswordError, setHighValuePasswordError] = useState("");
  const [highValueVerified, setHighValueVerified] = useState(false);
  const [highValueVerifying, setHighValueVerifying] = useState(false);
  const [memo, setMemo] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const destRef = useRef<HTMLInputElement>(null);

  const { draftRestored, dismissDraft } = useSendPrefill({
    searchParams, step, draft: txDraft, clearDraft: clearTxDraft, setDestination, setAmountStr,
  });

  const accountName = wallet?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;
  const hasPendingTx = hasPendingFromAccount(pendingTxs, identity);
  const walletAccountTargets = (wallet?.accounts ?? [])
    .map((a) => ({ name: a.name, identity: a.identity ?? accounts[a.index]?.identity ?? "", note: a.note }))
    .filter((a) => a.identity && a.identity !== identity);
  const canOpenPicker = contacts.length > 0 || walletAccountTargets.length > 0;
  const sendHeader = <SendHeader />;

  const destUpper = normalizeIdentity(destination);
  const matchedContact = contacts.find((c) => c.identity === destUpper);
  const amountValue = (() => { try { return BigInt(amountStr.trim() || "0"); } catch { return 0n; } })();
  const needsHighValueConfirmation = exceedsHighValueThreshold(amountValue, settings.highValueSendThreshold);

  const price = stats?.price;
  const fiatEquiv = price && amountStr ? formatPreferredCurrencyFromQu(amountStr, { usdPrice: price, ...quote }).text : null;
  const canToggleAmountUnit = fiatPerQubic(price, quote) !== null;

  function validateInputs(): boolean {
    let ok = true;
    if (!account) { setDestError("Account locked"); destRef.current?.focus(); return false; }
    if (!isValidIdentity(destUpper)) { setDestError("Invalid address"); destRef.current?.focus(); ok = false; } else setDestError("");
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
    if (!wallet?.encryptedData || !highValuePassword) return;
    setHighValueVerifying(true); setHighValuePasswordError("");
    try { await verifyWalletPassword(wallet.encryptedData, highValuePassword); setHighValueVerified(true); setHighValuePassword(""); }
    catch { setHighValuePasswordError("Wrong password"); }
    finally { setHighValueVerifying(false); }
  }

  function goReview() { if (validateInputs()) { setHighValueVerified(false); setHighValuePassword(""); setHighValuePasswordError(""); setStep("review"); } }

  function handleAmountChange(value: string) {
    setAmountStr(value);
    setAmountError("");
    if (amountUnit === "fiat") setFiatInput(qubicToFiatInput(value, price, quote));
  }

  function handleFiatInputChange(value: string) {
    setFiatInput(value);
    setAmountError("");
    setAmountStr(fiatInputToQubic(value, price, quote));
  }

  function toggleAmountUnit() {
    if (amountUnit === "fiat") {
      setAmountUnit("qubic");
      return;
    }
    if (!canToggleAmountUnit) return;
    setFiatInput(qubicToFiatInput(amountStr, price, quote));
    setAmountUnit("fiat");
  }

  function handlePercent(percent: 25 | 50 | 75 | 100) {
    if (balance === null) return;
    const next = percent === 100 ? balance : (balance * BigInt(percent)) / 100n;
    const value = next.toString();
    setAmountStr(value);
    setAmountError("");
    setFiatInput(qubicToFiatInput(value, price, quote));
  }

  async function send() {
    if (!account) return;
    setSending(true);
    try {
      const amount = BigInt(amountStr.trim());
      const { currentTick, targetTick } = await resolveTargetTick(settings.tickOffset);
      const { encoded, hash } = await buildTransferFromSession({ accountIndex: settings.activeAccountIndex, destination: destUpper, amount, targetTick, currentTick });
      await broadcastTx(encoded);
      addPendingTx({ hash, source: identity, destination: destUpper, amount: amount.toString(), targetTick, broadcastAt: Date.now() });
      if (matchedContact) updateContact(matchedContact.id, { lastUsedAt: Date.now() });
      if (memo.trim()) setTxMemo(hash, memo.trim());
      navigate("/dashboard");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      saveTxDraft({ destination: destUpper, amountStr, savedAt: Date.now() });
      setStep("error");
    } finally {
      setSending(false);
    }
  }

  if (step === "input") {
    return (
      <SendInputStep
        statusBar={sendHeader}
        draftRestored={draftRestored}
        onDismissDraft={dismissDraft}
        amountStr={amountStr}
        amountError={amountError}
        fiatEquiv={fiatEquiv}
        amountUnit={amountUnit}
        fiatInput={fiatInput}
        currencyLabel={quote.currency}
        canToggleAmountUnit={canToggleAmountUnit}
        onAmountChange={handleAmountChange}
        onFiatInputChange={handleFiatInputChange}
        onToggleAmountUnit={toggleAmountUnit}
        onPercent={handlePercent}
        balance={balance}
        destination={destination}
        destError={destError}
        destRef={destRef}
        matchedContactName={matchedContact?.name ?? null}
        canOpenPicker={canOpenPicker}
        onChangeDestination={(value) => { setDestination(value); setDestError(""); }}
        onPickerSelect={(value) => { setDestination(value); setDestError(""); setShowPicker(false); }}
        onReview={goReview}
        canReview={!!account}
        contacts={contacts}
        pickerAccounts={walletAccountTargets}
        showPicker={showPicker}
        onOpenPicker={() => setShowPicker(true)}
        onClosePicker={() => setShowPicker(false)}
      />
    );
  }

  if (step === "review") {
    return (
      <SendReviewStep
        amountStr={amountStr}
        matchedContactName={matchedContact?.name ?? null}
        destUpper={destUpper}
        accountName={accountName}
        identity={identity}
        balance={balance}
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
        canSign={!!account && !!tickInfo}
        onSend={send}
      />
    );
  }

  return (
    <SendErrorStep txError={txError} onRetry={() => setStep("review")} />
  );
}
