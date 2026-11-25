import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Clock01Icon, Home01Icon, ShieldAlertIcon, ShieldCheckIcon } from "@/lib/icons";
import { watchStatusColor, watchStatusLabel, type WatchResult } from "./send-flow";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { SendStepFooter, StatusSpinner } from "./send-ui";

/** Status row for send receipts. */
export function TxStatusDetailRow(
  { status, idleColor, targetTick, currentTick }: {
    status: WatchResult;
    idleColor: string;
    targetTick?: number;
    currentTick?: number;
  },
) {
  const icon = status === "confirmed"
    ? <ShieldCheckIcon size={16} style={{ color: "var(--color-accent)" }} />
    : status === "failed"
      ? <ShieldAlertIcon size={16} style={{ color: "var(--color-status-error)" }} />
      : <StatusSpinner />;
  const progressText = status === "pending" && targetTick !== undefined && currentTick !== undefined
    ? pendingTxProgress(targetTick, currentTick).timingText
    : null;
  return (
    <DetailRow
      icon={icon}
      label="Status"
      value={progressText ?? watchStatusLabel(status)}
      mono={false}
      valueColor={watchStatusColor(status, idleColor)}
    />
  );
}

/** Done / View history actions shared by the send result panes. */
export function SendDoneActions() {
  const navigate = useNavigate();
  return (
    <SendStepFooter>
      <div style={{ display: "flex", gap: "var(--space-3)", width: "100%" }}>
        <Button onClick={() => navigate("/dashboard")} style={{ flex: 1 }}>
          <Home01Icon size={16} aria-hidden="true" />
          Done
        </Button>
        <Button variant="secondary" onClick={() => navigate("/history")} style={{ flex: 1 }}>
          <Clock01Icon size={16} aria-hidden="true" />
          History
        </Button>
      </div>
    </SendStepFooter>
  );
}
