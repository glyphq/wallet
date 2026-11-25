import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { TxMemoField } from "@/components/tx-memo-field";
import { CheckmarkCircle01Icon, Clock01Icon, ShieldAlertIcon } from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { watchStatusLabel, type WatchResult } from "./send-flow";
import { SectionLabel, SendManyShell, SummaryRow } from "./send-many-ui";

export interface SendManySendingStepProps {
  totalAmount: bigint;
  recipientCount: number;
}

/** Send-many broadcast-in-flight step. */
export function SendManySendingStep({ totalAmount, recipientCount }: SendManySendingStepProps) {
  return (
    <SendManyShell>
      <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", minHeight: "60vh", alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
        <span aria-hidden="true" style={{ width: 20, height: 20, border: "2px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <div style={{ textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
            Broadcasting transaction
          </span>
          <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
            {formatQu(totalAmount)} QU to {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </SendManyShell>
  );
}

export interface SendManyDoneStepProps {
  totalAmount: bigint;
  recipientCount: number;
  txHash: string;
  savedTargetTick: number;
  currentTick: number;
  watchResult: WatchResult;
}

/** Send-many receipt step. */
export function SendManyDoneStep({
  totalAmount,
  recipientCount,
  txHash,
  savedTargetTick,
  currentTick,
  watchResult,
}: SendManyDoneStepProps) {
  const navigate = useNavigate();
  const statusText = watchResult === "pending"
    ? pendingTxProgress(savedTargetTick, currentTick).timingText
    : watchStatusLabel(watchResult);

  return (
    <SendManyShell footer={(
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button onClick={() => navigate("/dashboard")} style={{ flex: 1 }}>Done</Button>
        <Button variant="secondary" onClick={() => navigate("/history")} style={{ flex: 1 }}>
          <Clock01Icon size={16} aria-hidden="true" /> History
        </Button>
      </div>
    )}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-3) 0" }}>
          <FramedAvatar seed={txHash} size={40} />
          <CheckmarkCircle01Icon size={20} strokeWidth={1.5} color="var(--color-accent)" aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            {formatQu(totalAmount)} QU
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-accent)" }}>
            Sent to {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <SectionLabel>Broadcast details</SectionLabel>
          <SummaryRow label="Hash" value={truncateId(txHash)} />
          <SummaryRow label="Tick" value={savedTargetTick} />
          <SummaryRow label="Status" value={statusText} />
        </div>

        <TxMemoField hash={txHash} />
      </div>
    </SendManyShell>
  );
}

export interface SendManyErrorStepProps {
  txError: string;
  onRetry: () => void;
}

/** Send-many broadcast-failure step. */
export function SendManyErrorStep({ txError, onRetry }: SendManyErrorStepProps) {
  const navigate = useNavigate();
  return (
    <SendManyShell footer={(
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Button onClick={onRetry}>Try again</Button>
        <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => navigate("/send")}>
          Cancel
        </Button>
      </div>
    )}>
      <div role="alert" style={{ display: "flex", flexDirection: "column", minHeight: "60vh", alignItems: "center", justifyContent: "center", gap: "var(--space-3)", textAlign: "center" }}>
        <ShieldAlertIcon size={28} strokeWidth={1.5} color="var(--color-status-error)" aria-hidden="true" />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          Broadcast failed
        </span>
        <span style={{ maxWidth: 320, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
          {txError || "The transaction could not be broadcast."}
        </span>
      </div>
    </SendManyShell>
  );
}
