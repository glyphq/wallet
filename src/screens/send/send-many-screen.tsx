import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildPayload, type PayloadField } from "@qubic.org/tx";
import type { Identity } from "@qubic.org/types";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { useTxHistory } from "@/hooks/use-tx-history";
import { isValidIdentity, newId } from "@/lib/crypto";
import { getQutilSendManyFee } from "@/lib/api/contracts";
import { broadcastTx } from "@/lib/broadcast";
import { subscribeTxResolution } from "@/lib/tx-resolution-events";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { QUTIL_ADDRESS, QUTIL_SEND_TO_MANY_V1_INPUT_TYPE } from "@/lib/contracts";
import { extractMessage } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { buildAddressSuggestions, getRecentRecipientIdentities } from "@/lib/address-intelligence";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { exceedsHighValueThreshold } from "@/lib/session-policies";
import {
  hasPendingFromAccount, normalizeIdentity, resolveTargetTick, validateQuAmount,
  type SendStep, type WatchResult,
} from "./send-flow";
import {
  MAX_RECIPIENTS, emptyRecipient, sumRecipientAmounts, type Recipient,
} from "./send-many-recipients";
import { SendManyInputStep } from "./send-many-input-step";
import { SendManyReviewStep } from "./send-many-review-step";
import {
  SendManyDoneStep, SendManyErrorStep, SendManySendingStep,
} from "./send-many-result-steps";

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SendManyScreen() {
  const contacts = usePersistedStore((s) => s.contacts);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const settings = usePersistedStore((s) => s.settings);
  const accounts = useSessionStore((s) => s.accounts);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));
  const account = accounts[settings.activeAccountIndex] ?? null;
  const identity = getWalletAccountIdentity(wallet ?? null, settings.activeAccountIndex, accounts) ?? "";
  const apiIdentity = useApiCacheIdentity();
  const { data: feeData } = useQuery({
    queryKey: qk.qutilSendManyFee(apiIdentity),
    queryFn: () => getQutilSendManyFee(),
    staleTime: 60_000,
  });
  const fee = feeData?.ok ? feeData.value.fee : null;
  const hasPendingTx = hasPendingFromAccount(pendingTxs, identity);
  const { data: balanceData } = useBalance(identity || null);
  const { data: tickInfo } = useTickInfo();
  const balance = balanceData?.balance ?? null;
  const { data: stats } = useLatestStats();
  const quote = usePreferredCurrencyQuote();
  const price = stats?.price;
  const { data: recentTxsData } = useTxHistory(identity || null);
  const recentTxs = recentTxsData?.pages[0]?.items;

  const [step, setStep] = useState<SendStep>("input");
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient()]);
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [formError, setFormError] = useState("");
  const [watchResult, setWatchResult] = useState<WatchResult>("pending");
  const [savedTargetTick, setSavedTargetTick] = useState(0);
  const [sending, setSending] = useState(false);
  const [highValueConfirmed, setHighValueConfirmed] = useState(false);
  const identityRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!txHash) return;
    return subscribeTxResolution(txHash, (resolution) => {
      setWatchResult(resolution.status === "confirmed" ? "confirmed" : "failed");
    });
  }, [txHash]);

  const walletAccountTargets = (wallet?.accounts ?? [])
    .filter((a) => !a.hidden)
    .map((a) => ({ name: a.name, identity: a.identity ?? accounts[a.index]?.identity ?? "", note: a.note, tags: a.tags }))
    .filter((a) => a.identity && a.identity !== identity);
  const canOpenPicker = contacts.length > 0 || walletAccountTargets.length > 0;
  const recentRecipientIdentities = useMemo(() => getRecentRecipientIdentities(identity || null, recentTxs), [identity, recentTxs]);

  function setField(index: number, field: Partial<Recipient>) {
    setRecipients((prev) => prev.map((r, i) => (i === index ? { ...r, ...field } : r)));
  }

  const suggestionsByIndex = useMemo(
    () => recipients.map((r) => buildAddressSuggestions({
      query: r.identity, contacts, accounts: walletAccountTargets,
      currentIdentity: identity, recentIdentities: recentRecipientIdentities,
    })),
    [contacts, identity, recentRecipientIdentities, recipients, walletAccountTargets],
  );

  function addRecipient() {
    if (recipients.length < MAX_RECIPIENTS) setRecipients((prev) => [...prev, emptyRecipient()]);
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function registerIdentityRef(index: number, el: HTMLInputElement | null) {
    if (el) identityRefs.current.set(index, el);
    else identityRefs.current.delete(index);
  }

  function validateAll(): boolean {
    let ok = true;
    if (!account) { setFormError("Account locked"); return false; }
    const updated = recipients.map((r) => {
      const identityError = isValidIdentity(normalizeIdentity(r.identity)) ? "" : "Invalid address";
      const amountError = validateQuAmount(r.amount, {
        invalidMessage: "Invalid amount",
        insufficientMessage: "Invalid amount",
      }).error;
      if (identityError || amountError) ok = false;
      return { ...r, identityError, amountError };
    });
    let nextFormError = "";
    if (ok && balance !== null && fee !== null) {
      const deducted = sumRecipientAmounts(recipients) + fee;
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

  const totalAmount = sumRecipientAmounts(recipients);
  const needsHighValueConfirmation = exceedsHighValueThreshold(totalAmount, settings.highValueSendThreshold);

  async function send() {
    if (!account || fee === null) return;
    setSending(true);
    setStep("sending");
    try {
      const { currentTick, targetTick } = await resolveTargetTick(settings.tickOffset);
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
        inputType: QUTIL_SEND_TO_MANY_V1_INPUT_TYPE,
        payload, amount: total, targetTick, currentTick,
      });
      await broadcastTx(encoded);
      recipients.forEach((r) => {
        const id = r.identity.trim().toUpperCase();
        const contact = contacts.find((c) => c.identity === id);
        if (contact) updateContact(contact.id, { lastUsedAt: Date.now() });
      });
      addPendingTx({ hash, source: account.identity, destination: QUTIL_ADDRESS, amount: total.toString(), targetTick, broadcastAt: Date.now(), contractName: "QUtil · Send to Many" });
      setSavedTargetTick(targetTick); setTxHash(hash); setWatchResult("pending"); setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      setStep("error");
    } finally {
      setSending(false);
    }
  }

  if (step === "input") {
    return (
      <SendManyInputStep
        recipients={recipients}
        contacts={contacts}
        accounts={walletAccountTargets}
        price={price}
        quote={quote}
        balance={balance}
        fee={fee}
        totalAmount={totalAmount}
        formError={formError}
        suggestionsByIndex={suggestionsByIndex}
        canOpenPicker={canOpenPicker}
        onFieldChange={setField}
        onEnter={goReview}
        onAddRecipient={addRecipient}
        onRemoveRecipient={removeRecipient}
        registerIdentityRef={registerIdentityRef}
        onApplyImported={(next) => setRecipients(next.map((r) => ({
          id: newId(), identity: r.identity, amount: r.amount, identityError: "", amountError: "",
        })))}
        onReview={goReview}
        canReview={recipients.length > 0 && !!account}
      />
    );
  }

  if (step === "review") {
    return (
      <SendManyReviewStep
        recipients={recipients}
        contacts={contacts}
        totalAmount={totalAmount}
        fee={fee}
        hasPendingTx={hasPendingTx}
        needsHighValueConfirmation={needsHighValueConfirmation}
        highValueConfirmed={highValueConfirmed}
        onConfirmHighValue={() => setHighValueConfirmed(true)}
        sending={sending}
        canSend={!!account && fee !== null}
        onSend={send}
        onEdit={() => setStep("input")}
      />
    );
  }

  if (step === "sending") {
    return <SendManySendingStep totalAmount={totalAmount} recipientCount={recipients.length} />;
  }

  if (step === "done") {
    return (
      <SendManyDoneStep
        totalAmount={totalAmount}
        recipientCount={recipients.length}
        txHash={txHash}
        savedTargetTick={savedTargetTick}
        currentTick={tickInfo?.tick ?? 0}
        watchResult={watchResult}
      />
    );
  }

  return <SendManyErrorStep txError={txError} onRetry={() => setStep("review")} />;
}
