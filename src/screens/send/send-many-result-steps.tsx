import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Divider } from "@/components/divider";
import { TxMemoField } from "@/components/tx-memo-field";
import {
  ArrowUpRight01Icon, CheckmarkCircle01Icon, Clock01Icon, FlashIcon, ShieldAlertIcon,
} from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import { SendDoneActions, TxStatusDetailRow } from "./send-result";
import { SendStepPanel } from "./send-step-panel";
import { GhostActionButton, StatusSpinner, reviewSectionLabelStyle } from "./send-ui";
import type { WatchResult } from "./send-flow";

export interface SendManySendingStepProps {
  totalAmount: bigint;
  recipientCount: number;
}

/** Send-many broadcast-in-flight step. */
export function SendManySendingStep({ totalAmount, recipientCount }: SendManySendingStepProps) {
  return (
    <SendStepPanel centered gap="var(--space-4)" role="status" ariaLive="polite">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <StatusSpinner size={18} />
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>Broadcasting transaction</h2>
          <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            {formatQu(totalAmount)} QU to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <Divider />
      <DetailRow icon={<ArrowUpRight01Icon size={16} />} label="Contract" value="QUtil · Send to Many" mono={false} />
    </SendStepPanel>
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
  const linearGroupStyle: React.CSSProperties = { display: "flex", flexDirection: "column" };

  return (
    <SendStepPanel scroll="auto" gap="var(--space-3)">
      {/* Amount */}
      <div className="flash-success" style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-accent)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatQu(totalAmount)} QU
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          <CheckmarkCircle01Icon size={14} style={{ color: "var(--color-accent)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-accent)" }}>Sent to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div style={linearGroupStyle} aria-labelledby="send-many-completion-details">
        <span id="send-many-completion-details" style={reviewSectionLabelStyle}>Broadcast details</span>
        <DetailRow icon={<FlashIcon size={16} />} label="Hash" value={truncateId(txHash)} />
        <Divider />
        <DetailRow icon={<Clock01Icon size={16} />} label="Tick" value={String(savedTargetTick)} valueColor="var(--color-text-secondary)" />
        <Divider />
        <TxStatusDetailRow status={watchResult} idleColor="var(--color-text-disabled)" targetTick={savedTargetTick} currentTick={currentTick} />
      </div>

      <TxMemoField hash={txHash} />

      <div style={{ flex: 1 }} />

      <SendDoneActions />
    </SendStepPanel>
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
    <SendStepPanel centered gap="var(--space-4)" role="alert">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <ShieldAlertIcon size={18} style={{ color: "var(--color-status-error)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>Broadcast failed</h2>
          <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            {txError || "The transaction could not be broadcast."}
          </p>
        </div>
      </div>
      <Divider />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", paddingTop: "var(--space-2)" }}>
        <Button onClick={onRetry}>Try again</Button>
        <GhostActionButton onClick={() => navigate("/send")}>Cancel</GhostActionButton>
      </div>
    </SendStepPanel>
  );
}
