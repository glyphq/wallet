import { ArrowUpRight01Icon, ShieldAlertIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { formatQu, truncateId } from "@/lib/format";
import type { Contact } from "@/store/persisted";
import type { Recipient } from "./send-many-recipients";
import { SectionLabel, SendManyShell, SummaryRow } from "./send-many-ui";

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
  const totalWithFee = fee !== null ? totalAmount + fee : totalAmount;

  return (
    <SendManyShell footer={(
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Button
          onClick={onSend}
          loading={sending}
          disabled={!canSend || hasPendingTx || (needsHighValueConfirmation && !highValueConfirmed)}
        >
          Sign and send
          <ArrowUpRight01Icon size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={onEdit}>
          Edit
        </Button>
      </div>
    )}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-3) 0" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display)", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {formatQu(totalAmount)} QU
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
          </span>
        </div>

        {hasPendingTx ? (
          <span role="status" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-warning)" }}>
            Transfer pending — wait for confirmation.
          </span>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <SectionLabel>Recipients</SectionLabel>
          {recipients.map((recipient) => {
            const identity = recipient.identity.trim().toUpperCase();
            const contact = contacts.find((item) => item.identity === identity);
            return (
              <div key={recipient.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0, padding: "var(--space-2) 0" }}>
                <FramedAvatar seed={identity} size={30} />
                <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {contact?.name || truncateId(identity)}
                  </span>
                  {contact ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
                      {truncateId(identity)}
                    </span>
                  ) : null}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", flexShrink: 0 }}>
                  {formatQu(recipient.amount)} QU
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <SectionLabel>Transaction</SectionLabel>
          <SummaryRow label="Transfers" value={`${formatQu(totalAmount)} QU`} />
          <SummaryRow label="QUtil fee" value={fee !== null ? `${formatQu(fee)} QU` : "Loading…"} />
          <SummaryRow label="Total" value={`${formatQu(totalWithFee)} QU`} />
        </div>

        {needsHighValueConfirmation && !highValueConfirmed ? (
          <Button variant="secondary" size="md" onClick={onConfirmHighValue}>
            <ShieldAlertIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            Confirm high-value transfer
          </Button>
        ) : null}
        {needsHighValueConfirmation && highValueConfirmed ? (
          <span role="status" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-accent)" }}>
            High-value transfer confirmed.
          </span>
        ) : null}
      </div>
    </SendManyShell>
  );
}
