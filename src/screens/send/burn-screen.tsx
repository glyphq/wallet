import { useRef, useState } from "react";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { broadcastTx } from "@/lib/broadcast";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { QUTIL, QUTIL_ADDRESS, QUTIL_BURN_QUBIC_INPUT_TYPE } from "@/lib/contracts";
import { extractMessage } from "@/lib/format";
import { verifyWalletPassword } from "@/lib/wallet";
import { getWalletAccountIdentity } from "@/lib/accounts";
import {
  hasPendingFromAccount, resolveTargetTick, targetTickLabel, validateQuAmount,
} from "./send-flow";
import { BurnConfirmStep, BurnInputStep } from "./burn-form-steps";
import { BurnDoneStep, BurnErrorStep, BurnSendingStep } from "./burn-result-steps";

type BurnStep = "input" | "confirm" | "sending" | "done" | "error";

export default function BurnScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const accounts = useSessionStore((s) => s.accounts);
  const account = accounts[settings.activeAccountIndex] ?? null;
  const identity = getWalletAccountIdentity(wallet ?? null, settings.activeAccountIndex, accounts) ?? "";
  const accountName = wallet?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;
  const hasPendingTx = hasPendingFromAccount(pendingTxs, identity);
  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(identity || null);
  const balance = balanceData?.balance ?? null;

  const [step, setStep] = useState<BurnStep>("input");
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
    const validation = validateQuAmount(amountStr, {
      balance,
      invalidMessage: "Enter a whole QU amount greater than 0",
      insufficientMessage: "Amount is higher than your available balance",
    });
    if (validation.error) {
      setAmountError(validation.error); amountRef.current?.focus(); return;
    }
    setAmountError("");
    if (settings.requirePasswordForBurn && wallet?.encryptedData) {
      setNeedsPassword(true);
    }
    setStep("confirm");
  }

  async function send() {
    if (!wallet || !account) return;
    setSending(true);
    if (needsPassword && wallet?.encryptedData) {
      try {
        await verifyWalletPassword(wallet.encryptedData, burnPassword);
      } catch {
        setBurnPasswordError("Password did not unlock this wallet");
        setSending(false);
        return;
      }
    }
    await finalizeSend();
  }

  async function finalizeSend() {
    if (!account) return;
    setStep("sending");
    try {
      const amount = BigInt(amountStr.trim());
      const { currentTick, targetTick } = await resolveTargetTick(settings.tickOffset);
      const payload = QUTIL.encodeProcedure("BurnQubic", { amount });
      const inputType = QUTIL_BURN_QUBIC_INPUT_TYPE;
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
    } finally {
      setSending(false);
    }
  }

  if (step === "input") {
    return (
      <BurnInputStep
        amountStr={amountStr}
        amountError={amountError}
        balance={balance}
        amountRef={amountRef}
        onAmountChange={(value) => { setAmountStr(value); setAmountError(""); }}
        onConfirm={goConfirm}
        canReview={!!amountStr.trim() && !!account && !!tickInfo}
      />
    );
  }

  if (step === "confirm") {
    return (
      <BurnConfirmStep
        amountStr={amountStr}
        accountName={accountName}
        identity={identity}
        tickLabel={tickInfo ? targetTickLabel(tickInfo.tick ?? 0, settings.tickOffset) : "—"}
        needsPassword={needsPassword}
        password={burnPassword}
        passwordError={burnPasswordError}
        onPasswordChange={(value) => { setBurnPassword(value); setBurnPasswordError(""); }}
        onSend={send}
        sending={sending}
        hasPendingTx={hasPendingTx}
        canSend={!!account && !!tickInfo}
        onCancel={() => setStep("input")}
      />
    );
  }

  if (step === "sending") {
    return <BurnSendingStep amountStr={amountStr} />;
  }

  if (step === "done") {
    return <BurnDoneStep amountStr={amountStr} txHash={txHash} savedTargetTick={savedTargetTick} />;
  }

  return <BurnErrorStep txError={txError} onRetry={() => setStep("confirm")} />;
}
