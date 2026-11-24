import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ApprovalAddress } from "@/components/request/approval-address";
import { ApprovalAmount } from "@/components/request/approval-amount";
import { ApprovalField } from "@/components/request/approval-field";
import { MoneySend01Icon } from "@/lib/icons";
import { formatQu } from "@/lib/format";
import { useHideAppChrome } from "@/layouts/chrome-visibility";
import { SendStepPanel } from "./send-step-panel";
import { SendStepFooter } from "./send-ui";

export interface SendReviewStepProps {
  amountStr: string;
  matchedContactName: string | null;
  destUpper: string;
  accountName: string;
  identity: string;
  balance: bigint | null;
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
}

/** Transfer review built from the shared approval primitives. */
export function SendReviewStep({
  amountStr,
  matchedContactName,
  destUpper,
  accountName,
  identity,
  balance,
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
}: SendReviewStepProps) {
  useHideAppChrome();

  const reviewAmount = BigInt(amountStr);
  const balanceAfter = balance === null ? null : balance - reviewAmount;
  const sendDisabled = !canSign || hasPendingTx || (needsHighValueConfirmation && !highValueVerified);

  return (
    <SendStepPanel scroll="y" gap="var(--space-5)">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1 }}>
        <ApprovalAmount amount={reviewAmount} />

        <ApprovalAddress
          label="From"
          identity={identity}
          name={accountName}
          compact="short"
        />
        <ApprovalAddress
          label="To"
          identity={destUpper}
          name={matchedContactName ?? undefined}
          compact="long"
        />

        {balanceAfter !== null ? (
          <ApprovalField label="Remaining balance">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)", letterSpacing: "0.03em" }}>
              {formatQu(balanceAfter)} QUBIC
            </span>
          </ApprovalField>
        ) : null}

        <Input
          label="Note"
          value={memo}
          onChange={(event) => onMemoChange(event.target.value)}
          placeholder="Optional"
          autoComplete="off"
        />

        {hasPendingTx ? (
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-status-warning)" }}>
            This account already has a pending transfer. Wait for confirmation before sending another one.
          </p>
        ) : null}

        {needsHighValueConfirmation && !highValueVerified ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-status-warning)" }}>
              High-value confirmation
            </span>
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
              Enter your wallet password to approve this amount.
            </p>
            <Input
              type="password"
              label="Wallet password"
              value={highValuePassword}
              onChange={(event) => onHighValuePasswordChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !highValueVerifying && onVerifyHighValue()}
              error={highValuePasswordError}
              placeholder="••••••••••"
              autoComplete="current-password"
            />
            <Button variant="secondary" onClick={onVerifyHighValue} loading={highValueVerifying} disabled={!highValuePassword}>
              Confirm high-value transfer
            </Button>
          </div>
        ) : null}

        {needsHighValueConfirmation && highValueVerified ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-accent)" }}>
            High-value transfer confirmed
          </span>
        ) : null}
      </div>

      <SendStepFooter>
        <Button onClick={onSend} loading={sending} disabled={sendDisabled} style={{ width: "100%" }}>
          <MoneySend01Icon size={16} aria-hidden="true" />
          Send QUBIC
        </Button>
      </SendStepFooter>
    </SendStepPanel>
  );
}
