import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { ApprovalAddress } from "@/components/request/approval-address";
import { ApprovalAmount } from "@/components/request/approval-amount";
import { ApprovalDisclosure, ApprovalField } from "@/components/request/approval-field";
import { Clock01Icon, Home01Icon, RefreshIcon, ShieldAlertIcon } from "@/lib/icons";
import { watchStatusColor, watchStatusLabel, type WatchResult } from "./send-flow";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { useHideAppChrome } from "@/layouts/chrome-visibility";
import { SendStepPanel } from "./send-step-panel";
import { SendStepFooter } from "./send-ui";

export interface SendSendingStepProps {
  amountStr: string;
  matchedContactName: string | null;
  destUpper: string;
  accountName: string;
  identity: string;
  txHash: string;
  savedTargetTick: number;
  currentTick: number;
  watchResult: WatchResult;
}

/** Single broadcast/status screen that stays in place through confirmation. */
export function SendSendingStep({
  amountStr,
  matchedContactName,
  destUpper,
  accountName,
  identity,
  txHash,
  savedTargetTick,
  currentTick,
  watchResult,
}: SendSendingStepProps) {
  useHideAppChrome();
  const navigate = useNavigate();
  const broadcasting = !txHash;
  const progressText = txHash && watchResult === "pending"
    ? pendingTxProgress(savedTargetTick, currentTick).timingText
    : null;
  const statusText = broadcasting ? "Broadcasting…" : (progressText ?? watchStatusLabel(watchResult));

  return (
    <SendStepPanel scroll="y" gap="var(--space-5)" ariaLive="polite" ariaBusy={broadcasting}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-display)" }}>
              {broadcasting ? "Broadcasting transfer" : "Transfer submitted"}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
              {broadcasting ? "Waiting for the network to accept the transaction." : "Track the result below."}
            </div>
          </div>
        </div>

        <ApprovalAmount amount={BigInt(amountStr)} />
        <ApprovalAddress label="From" identity={identity} name={accountName} compact="short" />
        <ApprovalAddress label="To" identity={destUpper} name={matchedContactName ?? undefined} compact="long" />

        <ApprovalField label="Status">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: broadcasting ? "var(--color-text-tertiary)" : watchStatusColor(watchResult, "var(--color-text-secondary)") }}>
            {statusText}
          </span>
        </ApprovalField>

        <ApprovalDisclosure label="Transaction details">
          <ApprovalField label="Hash">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
              {txHash || "—"}
            </span>
          </ApprovalField>
          <ApprovalField label="Target tick">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
              {savedTargetTick || "—"}
            </span>
          </ApprovalField>
        </ApprovalDisclosure>
      </div>

      <SendStepFooter>
        <div style={{ display: "flex", gap: "var(--space-3)", width: "100%" }}>
          <Button onClick={() => navigate("/dashboard")} disabled={broadcasting} style={{ flex: 1 }}>
            <Home01Icon size={16} aria-hidden="true" />
            Done
          </Button>
          <Button variant="secondary" onClick={() => navigate("/history")} disabled={broadcasting} style={{ flex: 1 }}>
            <Clock01Icon size={16} aria-hidden="true" />
            History
          </Button>
        </div>
      </SendStepFooter>
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
