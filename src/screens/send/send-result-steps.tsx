import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { TxMemoField } from "@/components/tx-memo-field";
import {
  Bookmark01Icon, CheckmarkCircle01Icon, Clock01Icon, FlashIcon,
  ShieldAlertIcon, UserCircleIcon,
} from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import { SendDoneActions, TxStatusDetailRow } from "./send-result";
import { SendStepPanel } from "./send-step-panel";
import { StatusSpinner, GhostActionButton, labelStyle, rowGroupStyle, thinDividerStyle } from "./send-ui";
import type { WatchResult } from "./send-flow";

export interface SendSendingStepProps {
  amountStr: string;
  matchedContactName: string | null;
  destUpper: string;
}

/** Send broadcast-in-flight step. */
export function SendSendingStep({ amountStr, matchedContactName, destUpper }: SendSendingStepProps) {
  return (
    <SendStepPanel centered gap="var(--space-5)" ariaLive="polite" ariaBusy>
      <div style={{ borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)", padding: "var(--space-5) 0", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <StatusSpinner size={20} />
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-display)" }}>Broadcasting transfer</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
            {formatQu(amountStr)} to {matchedContactName ?? truncateId(destUpper)}
          </div>
        </div>
      </div>
    </SendStepPanel>
  );
}

export interface SendDoneStepProps {
  amountStr: string;
  matchedContactName: string | null;
  destUpper: string;
  txHash: string;
  savedTargetTick: number;
  watchResult: WatchResult;
  destIsKnownContact: boolean;
  onSaveContact: (name: string) => void;
}

/** Send receipt step with confirmation watch, contact save, and note. */
export function SendDoneStep({
  amountStr,
  matchedContactName,
  destUpper,
  txHash,
  savedTargetTick,
  watchResult,
  destIsKnownContact,
  onSaveContact,
}: SendDoneStepProps) {
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  function submitContact() {
    if (!saveName.trim()) return;
    onSaveContact(saveName.trim());
    setSaved(true);
  }

  return (
    <SendStepPanel scroll="auto" gap="var(--space-3)">
      {/* Amount */}
      <header className="flash-success" style={{ paddingTop: "var(--space-4)", paddingBottom: "var(--space-1)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ ...labelStyle, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}><CheckmarkCircle01Icon size={16} /> Transaction sent</span>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatQu(amountStr)}
        </div>
      </header>

      {/* Details */}
      <section aria-label="Broadcast receipt" style={rowGroupStyle}>
        <DetailRow
          icon={<UserCircleIcon size={16} />}
          label="To"
          value={matchedContactName ?? truncateId(destUpper)}
          mono={!matchedContactName}
          valueColor={matchedContactName ? "var(--color-accent)" : undefined}
        />
        <div style={thinDividerStyle} />
        <DetailRow icon={<FlashIcon size={16} />} label="Hash" value={truncateId(txHash)} />
        <div style={thinDividerStyle} />
        <DetailRow icon={<Clock01Icon size={16} />} label="Tick" value={String(savedTargetTick)} valueColor="var(--color-text-secondary)" />
        <div style={thinDividerStyle} />
        <TxStatusDetailRow status={watchResult} idleColor="var(--color-text-secondary)" />
      </section>

      {/* Save contact */}
      {!destIsKnownContact && !saved && (
        <form onSubmit={(e) => { e.preventDefault(); submitContact(); }} style={{
          borderTop: "1px solid var(--color-border-subtle)",
          borderBottom: "1px solid var(--color-border-subtle)",
          padding: "var(--space-3) 0",
          display: "flex", alignItems: "center", gap: "var(--space-3)",
        }}>
          <Bookmark01Icon size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
          <input aria-label="Contact name" autoComplete="off" value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Save as contact"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              color: "var(--color-text-display)", padding: 0, minWidth: 0,
            }}
          />
          <button type="submit" disabled={!saveName.trim()}
            style={{
              background: "none", border: "none", cursor: saveName.trim() ? "pointer" : "default",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
              color: saveName.trim() ? "var(--color-accent)" : "var(--color-text-disabled)",
              padding: 0, flexShrink: 0,
            }}>
            Save
          </button>
        </form>
      )}
      {saved && (
        <div style={{
          borderTop: "1px solid var(--color-border-subtle)",
          borderBottom: "1px solid var(--color-border-subtle)",
          padding: "var(--space-3) 0",
          display: "flex", alignItems: "center", gap: "var(--space-3)",
        }}>
          <CheckmarkCircle01Icon size={16} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-accent)" }}>Contact saved</span>
        </div>
      )}

      {/* Notes */}
      <TxMemoField hash={txHash} />

      <div style={{ flex: 1 }} />

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
  const navigate = useNavigate();
  return (
    <SendStepPanel centered gap="var(--space-5)" role="alert">
      <div style={{ borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)", padding: "var(--space-5) 0", display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <ShieldAlertIcon size={20} style={{ color: "var(--color-status-error)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-display)" }}>Broadcast failed</div>
          <p style={{ margin: "var(--space-2) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {txError || "The transaction could not be broadcast."}
          </p>
          <p style={{ margin: "var(--space-2) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
            Your draft was kept so you can review and try again.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", paddingTop: "var(--space-2)" }}>
        <Button onClick={onRetry}>Review and try again</Button>
        <GhostActionButton onClick={() => navigate("/dashboard")}>Cancel</GhostActionButton>
      </div>
    </SendStepPanel>
  );
}
