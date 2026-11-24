import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { ShieldAlertIcon, ShieldCheckIcon } from "@/lib/icons";
import { watchStatusColor, watchStatusLabel, type WatchResult } from "./send-flow";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { GhostActionButton, StatusSpinner } from "./send-ui";

/** Status row shared by send and send-many receipts. */
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
      <Button onClick={() => navigate("/dashboard")}>Done</Button>
      <GhostActionButton onClick={() => navigate("/history")}>View history</GhostActionButton>
    </div>
  );
}
