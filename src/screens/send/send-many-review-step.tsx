import type { CSSProperties } from "react";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Divider } from "@/components/divider";
import {
  ArrowUpRight01Icon, Clock01Icon, FlashIcon, ShieldAlertIcon, ShieldCheckIcon,
  UserCircleIcon, Wallet01Icon,
} from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import type { Contact } from "@/store/persisted";
import type { Recipient } from "./send-many-recipients";
import { SendStepPanel } from "./send-step-panel";
import { GhostActionButton, labelStyle, reviewSectionLabelStyle } from "./send-ui";

export interface SendManyReviewStepProps {
  recipients: Recipient[];
  contacts: Contact[];
  totalAmount: bigint;
  fee: bigint | null;
  hasPendingTx: boolean;
  needsHighValueConfirmation: boolean;
  highValueConfirmed: boolean;
  onConfirmHighValue: () => void;
  sending: boolean;
  canSend: boolean;
  onSend: () => void;
  onEdit: () => void;
}

/** Send-many review step: recipients, totals, guards, sign action. */
export function SendManyReviewStep({
  recipients,
  contacts,
  totalAmount,
  fee,
  hasPendingTx,
  needsHighValueConfirmation,
  highValueConfirmed,
  onConfirmHighValue,
  sending,
  canSend,
  onSend,
  onEdit,
}: SendManyReviewStepProps) {
  const linearGroupStyle: CSSProperties = { display: "flex", flexDirection: "column" };
  const noticeStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    minHeight: 44,
    padding: "var(--space-3) 0",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    textAlign: "left",
    width: "100%",
  };
  const totalWithFee = fee !== null ? totalAmount + fee : totalAmount;

  return (
    <SendStepPanel scroll="auto" gap="var(--space-3)">
      {/* Amount */}
      <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatQu(totalAmount)} QU
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
          {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={linearGroupStyle} aria-labelledby="send-many-review-recipients">
        <span id="send-many-review-recipients" style={reviewSectionLabelStyle}>Recipients</span>
        {recipients.map((r, i) => {
          const id = r.identity.trim().toUpperCase();
          const contact = contacts.find((c) => c.identity === id);
          return (
            <div key={r.id}>
              {i > 0 && <Divider />}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 44, padding: "var(--space-2) 0" }}>
                <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><UserCircleIcon size={16} /></span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: contact ? "var(--color-accent)" : "var(--color-text-display)" }}>
                    {contact ? contact.name : truncateId(id)}
                  </span>
                  {contact && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{truncateId(id)}</span>
                  )}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-display)", flexShrink: 0 }}>
                  {formatQu(r.amount)} QU
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={linearGroupStyle} aria-labelledby="send-many-review-totals">
        <span id="send-many-review-totals" style={reviewSectionLabelStyle}>Transaction</span>
        <DetailRow icon={<ArrowUpRight01Icon size={16} />} label="Transfers" value={`${formatQu(totalAmount)} QU`} />
        <Divider />
        <DetailRow icon={<FlashIcon size={16} />} label="QUtil fee" value={fee !== null ? `${formatQu(fee)} QU` : "Loading…"} mono={false} />
        <Divider />
        <DetailRow icon={<Wallet01Icon size={16} />} label="Total" value={`${formatQu(totalWithFee)} QU`} mono={false} valueColor="var(--color-text-display)" />
      </div>

      {/* Pending warning */}
      {hasPendingTx && (
        <div role="status" style={noticeStyle}>
          <Clock01Icon size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
          <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Transfer pending — wait for confirmation</span>
        </div>
      )}

      {/* High value confirmation */}
      {needsHighValueConfirmation && !highValueConfirmed && (
        <button type="button" style={{ ...noticeStyle, cursor: "pointer", userSelect: "none" }}
          aria-pressed={highValueConfirmed}
          onClick={onConfirmHighValue}
        >
          <ShieldAlertIcon size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
          <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>High-value transfer — tap to confirm</span>
        </button>
      )}
      {needsHighValueConfirmation && highValueConfirmed && (
        <div role="status" style={noticeStyle}>
          <ShieldCheckIcon size={16} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-accent)" }}>High-value transfer confirmed</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
        <Button onClick={onSend} loading={sending} disabled={!canSend || hasPendingTx || (needsHighValueConfirmation && !highValueConfirmed)}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
            Sign and send <ArrowUpRight01Icon size={16} strokeWidth={2} />
          </span>
        </Button>
        <GhostActionButton onClick={onEdit}>Edit</GhostActionButton>
      </div>
    </SendStepPanel>
  );
}
