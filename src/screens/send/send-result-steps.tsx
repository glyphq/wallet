import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { TxMemoField } from "@/components/tx-memo-field";
import { ApprovalAddress } from "@/components/request/approval-address";
import { ApprovalAmount } from "@/components/request/approval-amount";
import { ApprovalDisclosure, ApprovalField } from "@/components/request/approval-field";
import { CheckmarkCircle01Icon, RefreshIcon, ShieldAlertIcon } from "@/lib/icons";
import { watchStatusColor, watchStatusLabel, type WatchResult } from "./send-flow";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { useHideAppChrome } from "@/layouts/chrome-visibility";
import { SendDoneActions } from "./send-result";
import { SendStepPanel } from "./send-step-panel";
import { SendStepFooter, StatusSpinner } from "./send-ui";

export interface SendSendingStepProps {
  amountStr: string;
  matchedContactName: string | null;
  destUpper: string;
}

/** Send broadcast-in-flight step. */
export function SendSendingStep({ amountStr, matchedContactName, destUpper }: SendSendingStepProps) {
  useHideAppChrome();
  return (
    <SendStepPanel centered gap="var(--space-5)" ariaLive="polite" ariaBusy>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <StatusSpinner size={20} />
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-display)" }}>
              Broadcasting transfer
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
              Waiting for the network to accept the transaction.
            </div>
          </div>
        </div>
        <ApprovalAmount amount={BigInt(amountStr)} />
        <ApprovalAddress label="To" identity={destUpper} name={matchedContactName ?? undefined} compact="long" />
      </div>
    </SendStepPanel>
  );
}

export interface SendDoneStepProps {
  amountStr: string;
  matchedContactName: string | null;
  destUpper: string;
  accountName: string;
  identity: string;
  txHash: string;
  savedTargetTick: number;
  currentTick: number;
  watchResult: WatchResult;
  destIsKnownContact: boolean;
  onSaveContact: (name: string) => void;
}

/** Send receipt with confirmation status, optional contact save, and note. */
export function SendDoneStep({
  amountStr,
  matchedContactName,
  destUpper,
  accountName,
  identity,
  txHash,
  savedTargetTick,
  currentTick,
  watchResult,
  destIsKnownContact,
  onSaveContact,
}: SendDoneStepProps) {
  useHideAppChrome();
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  const progressText = watchResult === "pending"
    ? pendingTxProgress(savedTargetTick, currentTick).timingText
    : null;
  const statusText = progressText ?? watchStatusLabel(watchResult);

  function submitContact() {
    if (!saveName.trim()) return;
    onSaveContact(saveName.trim());
    setSaved(true);
  }

  return (
    <SendStepPanel scroll="y" gap="var(--space-5)">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-accent)" }}>
          <CheckmarkCircle01Icon size={15} aria-hidden="true" />
          Transaction sent
        </span>

        <ApprovalAmount amount={BigInt(amountStr)} />

        <ApprovalAddress label="From" identity={identity} name={accountName} compact="short" />
        <ApprovalAddress label="To" identity={destUpper} name={matchedContactName ?? undefined} compact="long" />

        <ApprovalField label="Status">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: watchStatusColor(watchResult, "var(--color-text-secondary)") }}>
            {statusText}
          </span>
        </ApprovalField>

        <ApprovalDisclosure label="Transaction details">
          <ApprovalField label="Hash">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
              {txHash}
            </span>
          </ApprovalField>
          <ApprovalField label="Target tick">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>{savedTargetTick}</span>
          </ApprovalField>
        </ApprovalDisclosure>

        {!destIsKnownContact && !saved ? (
          <form onSubmit={(event) => { event.preventDefault(); submitContact(); }}>
            <Input
              label="Save as contact"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="Contact name"
              autoComplete="off"
              rightElement={(
                <button
                  type="submit"
                  disabled={!saveName.trim()}
                  style={{ border: 0, background: "transparent", padding: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: saveName.trim() ? "var(--color-accent)" : "var(--color-text-disabled)", cursor: saveName.trim() ? "pointer" : "default" }}
                >
                  Save
                </button>
              )}
            />
          </form>
        ) : null}
        {saved ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-accent)" }}>
            Contact saved
          </span>
        ) : null}

        <TxMemoField hash={txHash} />
      </div>

      <SendDoneActions />
    </SendStepPanel>
  );
}

export interface SendErrorStepProps {
  txError: string;
  onRetry: () => void;
}

/** Send broadcast-failure step. */
export function SendErrorStep({ txError, onRetry }: SendErrorStepProps) {
  useHideAppChrome();
  const navigate = useNavigate();
  return (
    <SendStepPanel scroll="y" gap="var(--space-5)" role="alert">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <ShieldAlertIcon size={20} style={{ color: "var(--color-status-error)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-display)" }}>
              Broadcast failed
            </div>
            <p style={{ margin: "var(--space-2) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-body)" }}>
              {txError || "The transaction could not be broadcast."}
            </p>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-tertiary)", lineHeight: "var(--leading-body)" }}>
          Your draft was kept so you can review and try again.
        </p>
      </div>

      <SendStepFooter>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Button onClick={onRetry}>
            <RefreshIcon size={16} aria-hidden="true" />
            Review and try again
          </Button>
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            Cancel
          </Button>
        </div>
      </SendStepFooter>
    </SendStepPanel>
  );
}
