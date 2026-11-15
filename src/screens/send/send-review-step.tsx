import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Input } from "@/components/input";
import {
  Clock01Icon, FlashIcon, Note01Icon, ShieldAlertIcon, ShieldCheckIcon,
  UserCircleIcon, Wallet01Icon, WalletAdd01Icon,
} from "@/lib/icons";
import { formatQu, truncateId } from "@/lib/format";
import { targetTickLabel } from "./send-flow";
import { SendStepPanel } from "./send-step-panel";
import { GhostActionButton, labelStyle, rowGroupStyle, thinDividerStyle } from "./send-ui";

export interface SendReviewStepProps {
  amountStr: string;
  fiatEquiv: string | null;
  price: number | undefined;
  matchedContactName: string | null;
  destUpper: string;
  accountName: string;
  identity: string;
  balance: bigint | null;
  tickInfo: { tick?: number } | null | undefined;
  tickOffset: number;
  hasPendingTx: boolean;
  needsHighValueConfirmation: boolean;
  highValueVerified: boolean;
  highValuePassword: string;
  highValuePasswordError: string;
  highValueVerifying: boolean;
  onHighValuePasswordChange: (value: string) => void;
  onVerifyHighValue: () => void;
  memo: string;
  onMemoChange: (value: string) => void;
  sending: boolean;
  canSign: boolean;
  onSend: () => void;
  onEdit: () => void;
}

/** Send review step: facts, high-value confirmation, note, sign action. */
export function SendReviewStep({
  amountStr,
  fiatEquiv,
  price,
  matchedContactName,
  destUpper,
  accountName,
  identity,
  balance,
  tickInfo,
  tickOffset,
  hasPendingTx,
  needsHighValueConfirmation,
  highValueVerified,
  highValuePassword,
  highValuePasswordError,
  highValueVerifying,
  onHighValuePasswordChange,
  onVerifyHighValue,
  memo,
  onMemoChange,
  sending,
  canSign,
  onSend,
  onEdit,
}: SendReviewStepProps) {
  const noticeStyle: React.CSSProperties = {
    borderTop: "1px solid var(--color-border-subtle)",
    borderBottom: "1px solid var(--color-border-subtle)",
    padding: "var(--space-4) 0",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
  };
  const targetTick = tickInfo ? targetTickLabel(tickInfo.tick ?? 0, tickOffset) : "Unavailable";
  const reviewAmount = BigInt(amountStr);
  const balanceAfter = balance === null ? null : balance - reviewAmount;

  return (
    <SendStepPanel scroll="auto" gap="var(--space-4)">
      {/* Amount */}
      <header style={{ paddingTop: "var(--space-3)", paddingBottom: "var(--space-1)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ ...labelStyle, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Review transfer</span>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatQu(amountStr)}
        </div>
        {price && amountStr && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
            {fiatEquiv && fiatEquiv !== "—" ? fiatEquiv : null}
          </div>
        )}
      </header>

      {/* Parties */}
      <section aria-label="Transfer parties" style={rowGroupStyle}>
        <DetailRow
          icon={<UserCircleIcon size={16} />}
          label="To"
          value={matchedContactName ?? truncateId(destUpper)}
          mono={!matchedContactName}
          valueColor={matchedContactName ? "var(--color-accent)" : undefined}
        />
        <div style={thinDividerStyle} />
        <DetailRow
          icon={<Wallet01Icon size={16} />}
          label="From"
          value={`${accountName} · ${truncateId(identity)}`}
          mono={false}
        />
      </section>

      {/* Details */}
      <section aria-label="Transaction facts" style={rowGroupStyle}>
        <DetailRow
          icon={<WalletAdd01Icon size={16} />}
          label="Balance after"
          value={balanceAfter === null ? "Unavailable" : `${formatQu(balanceAfter)} QU`}
          mono={false}
          valueColor={balanceAfter === null ? undefined : "var(--color-text-primary)"}
        />
        <div style={thinDividerStyle} />
        <DetailRow
          icon={<Clock01Icon size={16} />}
          label="Target tick"
          value={targetTick}
        />
        <div style={thinDividerStyle} />
        <DetailRow
          icon={<FlashIcon size={16} />}
          label="Fee"
          value="None"
          mono={false}
        />
      </section>

      <aside
        aria-label="Balance impact"
        style={{
          background: "var(--color-bg-surface-2)",
          border: "1px solid var(--color-border-default)",
          borderRadius: "var(--radius-control)",
          padding: "var(--space-3) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
        }}
      >
        <span style={{ ...labelStyle, color: "var(--color-text-secondary)" }}>You will spend</span>
        <strong style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-display)" }}>
          {formatQu(reviewAmount)} QU
        </strong>
        {balanceAfter !== null ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            Remaining balance: {formatQu(balanceAfter)} QU
          </span>
        ) : null}
      </aside>

      {/* Pending warning */}
      {hasPendingTx && (
        <aside role="status" style={noticeStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", color: "var(--color-status-warning)" }}>
            <Clock01Icon size={16} style={{ flexShrink: 0 }} />
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Pending transfer detected</span>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Wait for confirmation before signing another transfer from this account.</p>
        </aside>
      )}

      {/* High value confirmation */}
      {needsHighValueConfirmation && !highValueVerified && (
        <section aria-labelledby="high-value-confirmation" style={noticeStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", color: "var(--color-status-warning)" }}>
            <ShieldAlertIcon size={16} style={{ flexShrink: 0 }} />
            <span id="high-value-confirmation" style={{ ...labelStyle, color: "var(--color-status-warning)" }}>High-value confirmation required</span>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Enter your wallet password to explicitly approve this amount.</p>
          <Input type="password" label="Wallet password" value={highValuePassword}
            onChange={(e) => onHighValuePasswordChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !highValueVerifying && onVerifyHighValue()}
            error={highValuePasswordError} placeholder="••••••••••" autoComplete="current-password" />
          <Button variant="secondary" onClick={onVerifyHighValue} loading={highValueVerifying} disabled={!highValuePassword}>Confirm high-value transfer</Button>
        </section>
      )}
      {needsHighValueConfirmation && highValueVerified && (
        <div role="status" style={{ ...noticeStyle, flexDirection: "row", alignItems: "center", color: "var(--color-accent)" }}>
          <ShieldCheckIcon size={16} style={{ flexShrink: 0 }} />
          <span style={{ ...labelStyle, color: "var(--color-accent)" }}>High-value transfer confirmed</span>
        </div>
      )}

      {/* Memo */}
      <label style={{
        borderTop: "1px solid var(--color-border-subtle)",
        borderBottom: "1px solid var(--color-border-subtle)",
        padding: "var(--space-3) 0",
        display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      }}>
        <Note01Icon size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)", marginTop: 2 }} />
        <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Transfer note</span>
        <textarea
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "var(--color-text-display)", fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)", lineHeight: 1.5, padding: 0,
            resize: "none", boxSizing: "border-box", minWidth: 0,
          }}
        />
      </label>

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
        <Button onClick={onSend} loading={sending} disabled={!canSign || hasPendingTx || (needsHighValueConfirmation && !highValueVerified)}>Sign and send</Button>
        <GhostActionButton onClick={onEdit}>Edit transfer</GhostActionButton>
      </div>
    </SendStepPanel>
  );
}
