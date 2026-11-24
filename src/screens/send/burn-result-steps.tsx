import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Clock01Icon, FireIcon, FlashIcon, ShieldAlertIcon, Wallet01Icon } from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import { SendStepPanel } from "./send-step-panel";
import { ghostActionStyle, rowGroupStyle, statusCopyStyle, thinDividerStyle } from "./send-ui";

export interface BurnSendingStepProps {
  amountStr: string;
}

/** Burn broadcast-in-flight step. */
export function BurnSendingStep({ amountStr }: BurnSendingStepProps) {
  return (
    <SendStepPanel centered alignCenter gap="var(--space-5)">
      <div style={{ width: 48, height: 48, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ position: "absolute", inset: 0, border: "3px solid var(--color-border-subtle)", borderTopColor: "var(--color-status-error)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <FireIcon size={18} style={{ color: "var(--color-status-error)" }} />
      </div>
      <div role="status" aria-live="polite" style={{ textAlign: "center", maxWidth: 280 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>Broadcasting burn</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
          {formatQu(amountStr)} QU
        </div>
        <div style={{ ...statusCopyStyle, marginTop: "var(--space-3)" }}>
          Keep Glyph open while the network receives the transaction. If this fails, no pending burn is added here.
        </div>
      </div>
    </SendStepPanel>
  );
}

export interface BurnDoneStepProps {
  amountStr: string;
  txHash: string;
  savedTargetTick: number;
}

/** Burn receipt step. */
export function BurnDoneStep({ amountStr, txHash, savedTargetTick }: BurnDoneStepProps) {
  const navigate = useNavigate();
  return (
    <SendStepPanel scroll="auto" gap="var(--space-3)">
      {/* Amount */}
      <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
          <FireIcon size={64} style={{ color: "var(--color-status-error)" }} />
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "1.5rem", color: "var(--color-text-display)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          QU burned
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-disabled)", letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: "var(--space-2)" }}>
          {formatQu(amountStr)}
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ ...statusCopyStyle, color: "var(--color-text-primary)", borderLeft: "2px solid var(--color-status-success)", padding: "var(--space-2) 0 var(--space-2) var(--space-3)" }}>
        Broadcast accepted. The burn is pending network confirmation and has been added to history.
      </div>

      {/* Details */}
      <div aria-label="Broadcast details" style={rowGroupStyle}>
        <DetailRow icon={<FlashIcon size={16} />} label="Hash" value={truncateId(txHash)} />
        <div style={thinDividerStyle} />
        <DetailRow icon={<Clock01Icon size={16} />} label="Tick" value={String(savedTargetTick)} valueColor="var(--color-text-secondary)" />
        <div style={thinDividerStyle} />
        <DetailRow icon={<Wallet01Icon size={16} />} label="Status" value="Pending" valueColor="var(--color-text-disabled)" mono={false} />
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
        <Button onClick={() => navigate("/dashboard")}>Done</Button>
        <button type="button" onClick={() => navigate("/history")} style={ghostActionStyle}>
          View history
        </button>
      </div>
    </SendStepPanel>
  );
}

export interface BurnErrorStepProps {
  txError: string;
  onRetry: () => void;
}

/** Burn broadcast-failure step. */
export function BurnErrorStep({ txError, onRetry }: BurnErrorStepProps) {
  const navigate = useNavigate();
  return (
    <SendStepPanel centered alignCenter gap="var(--space-4)">
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-status-error-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ShieldAlertIcon size={22} style={{ color: "var(--color-status-error)" }} />
      </div>
      <div role="alert" style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>Burn not broadcast</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)", maxWidth: 280 }}>
          {txError || "The burn transaction could not be broadcast."}
        </div>
        <div style={{ ...statusCopyStyle, marginTop: "var(--space-3)", maxWidth: 280 }}>
          No pending burn was added by this screen. Review the message and retry only if you still intend to destroy this QU.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 280, paddingTop: "var(--space-2)" }}>
        <Button variant="danger" onClick={onRetry}>Try again</Button>
        <button type="button" onClick={() => navigate("/send")} style={ghostActionStyle}>
          Cancel
        </button>
      </div>
    </SendStepPanel>
  );
}
